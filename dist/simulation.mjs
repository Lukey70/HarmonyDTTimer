export const TARGETS = { order: 30, window: 60, total: 90 };

export const STATUS_THRESHOLDS = {
  yellow: 90,
  red: 120,
};

export const POSITION_META = {
  entry: { next: 'order' },
  order: { next: 'gap3', station: 'order' },
  gap3: { next: 'gap2' },
  gap2: { next: 'gap1' },
  gap1: { next: 'window' },
  window: { next: 'exit', station: 'window' },
};

const STATIONS = new Set(['order', 'window']);

export class DriveThruSimulator {
  constructor(savedState = null) {
    this.now = 0;
    this.nextCarId = 1;
    this.activeCars = [];
    this.completedCars = [];
    this.statusMessage = 'Ready.';
    if (savedState) this.load(savedState);
  }

  reset() {
    this.now = 0;
    this.nextCarId = 1;
    this.activeCars = [];
    this.completedCars = [];
    this.statusMessage = 'Ready.';
  }

  serialize() {
    return { now: this.now, nextCarId: this.nextCarId, activeCars: this.activeCars, completedCars: this.completedCars, statusMessage: this.statusMessage };
  }

  load(state) {
    this.now = Number(state.now) || 0;
    this.nextCarId = Number(state.nextCarId) || 1;
    this.activeCars = Array.isArray(state.activeCars) ? state.activeCars : [];
    this.completedCars = Array.isArray(state.completedCars) ? state.completedCars : [];
    this.statusMessage = state.statusMessage || 'Ready.';
  }

  carAt(position) { return this.activeCars.find((car) => car.position === position) || null; }

  addCar(lane = 1) {
    if (lane !== 1) return { ok: false, reason: 'Harmony has one lane.' };
    const spawn = 'entry';
    if (this.carAt(spawn)) return { ok: false, reason: 'The entry space is full.' };
    const car = {
      id: this.nextCarId++, lane, position: spawn, positionEnteredAt: this.now,
      totalStartedAt: null, orderReleaseAt: null, releaseRequested: false,
      thresholds: { yellow: false, red: false },
      timings: { order: null, window: null, total: null },
      completedAt: null,
    };
    this.activeCars.push(car);
    this.statusMessage = `Car #${car.id} added to the lane.`;
    return { ok: true, car, events: [{ type: 'lane1-entry', carId: car.id }] };
  }

  releaseStation(station) {
    if (!STATIONS.has(station)) return { ok: false, reason: 'Unknown station.' };
    const car = this.carAt(station);
    if (!car) {
      this.statusMessage = `No car at ${station}.`;
      return { ok: false, reason: `No car at ${station}.` };
    }
    if (car.releaseRequested) {
      this.statusMessage = `Car #${car.id} is already ready to leave ${station}.`;
      return { ok: true, car, alreadyRequested: true };
    }
    car.releaseRequested = true;
    car.orderReleaseAt = STATIONS.has(station) ? this.now : car.orderReleaseAt;
    this.statusMessage = `Car #${car.id} is ready to leave ${station} when the path clears.`;
    return { ok: true, car };
  }

  stationElapsed(car) { return this.now - car.positionEnteredAt; }
  totalElapsed(car) { return car.totalStartedAt == null ? 0 : this.now - car.totalStartedAt; }
  getCarsInLaneCount() { return this.activeCars.length; }
  getLongestCurrentTotal() { let longest = 0; for (const car of this.activeCars) longest = Math.max(longest, this.totalElapsed(car)); return longest; }

  tick(seconds = 1) {
    const allEvents = [];
    for (let i = 0; i < seconds; i += 1) {
      this.now += 1;
      const events = [];
      this.processMovement(events);
      this.processThresholds(events);
      allEvents.push(...events);
    }
    return allEvents;
  }

  processThresholds(events) {
    for (const car of this.activeCars) {
      const total = this.totalElapsed(car);
      if (car.totalStartedAt != null && !car.thresholds.yellow && total >= STATUS_THRESHOLDS.yellow) {
        car.thresholds.yellow = true;
        events.push({ type: 'yellow-threshold', carId: car.id, lane: car.lane });
      }
      if (car.totalStartedAt != null && !car.thresholds.red && total >= STATUS_THRESHOLDS.red) {
        car.thresholds.red = true;
        events.push({ type: 'red-threshold', carId: car.id, lane: car.lane });
      }
    }
  }

  canLeaveStation(car) {
    const meta = POSITION_META[car.position];
    if (!meta.station) return true;
    return !!car.releaseRequested;
  }

  canMoveFrom(position) {
    const car = this.carAt(position);
    if (!car) return false;
    if ((this.now - car.positionEnteredAt) < 1) return false;
    const meta = POSITION_META[position];
    if (!meta.next) return false;
    if (meta.station) return this.canLeaveStation(car);
    return true;
  }

  processMovement(events) {
    const occupiedStart = new Set(this.activeCars.map((car) => car.position));
    const plannedMoves = [];
    const isEmptyAtStart = (position) => !occupiedStart.has(position);
    const planMove = (car, target) => plannedMoves.push({ carId: car.id, from: car.position, to: target });

    // Brighton movement rules: one step per second, using occupancy at tick start.
    // A released car stays at its station until the next space is clear.
    for (const position of ['window', 'gap1', 'gap2', 'gap3', 'order', 'entry']) {
      const car = this.carAt(position);
      const next = POSITION_META[position].next;
      if (car && this.canMoveFrom(position) && (next === 'exit' || isEmptyAtStart(next))) planMove(car, next);
    }

    if (!plannedMoves.length) return;

    for (const move of plannedMoves) {
      const car = this.activeCars.find((active) => active.id === move.carId);
      if (!car) continue;
      const previous = move.from;
      const target = move.to;
      const previousMeta = POSITION_META[previous];

      if (previousMeta.station) {
        const elapsed = this.now - car.positionEnteredAt;
        car.timings[previous] = elapsed;
        car.releaseRequested = false;
        if (previous === 'order') car.totalStartedAt = this.now;
      }

      if (target === 'exit') {
        car.timings.total = car.totalStartedAt != null ? this.now - car.totalStartedAt : 0;
        car.completedAt = this.now;
        this.completedCars.unshift({ ...car });
        this.activeCars = this.activeCars.filter((active) => active.id !== car.id);
        events.push({ type: 'car-completed', carId: car.id, lane: car.lane });
        this.statusMessage = `Car #${car.id} completed the drive thru.`;
      } else {
        car.position = target;
        car.positionEnteredAt = this.now;
        if (previous === 'order') car.orderReleaseAt = this.now;
        events.push({ type: 'car-moved', carId: car.id, from: previous, to: target });
      }
    }
  }
}

export function computeScoreboard(completedCars) {
  const rows = completedCars || [];
  const result = {};
  for (const key of Object.keys(TARGETS)) {
    const values = rows.map(car => car.timings[key]).filter(Number.isFinite);
    result[key] = {
      avg: values.length ? values.reduce((a,b) => a+b,0) / values.length : 0,
      pct: values.length ? Math.round(100 * values.filter(v => v <= TARGETS[key]).length / values.length) : 0,
    };
  }
  return result;
}
