# Harmony Drive Thru Timer

Adapted directly from [Lukey70/DTTimerBrighton](https://github.com/Lukey70/DTTimerBrighton), retaining its blue Bloxburg-style interface, embedded car graphics and audio, scoreboard, controls, completed-car history and fullscreen mode.

## Harmony changes

- One lane, with six spaces matching the reference: Entry → Order → three forward spaces → Window → Exit.
- No second order lane, cash station, cash statistics or cash controls.
- Present renamed **Window**, with a **1:00 target**.
- Brighton's Order target (0:30), Total target (1:30), total-time car colours and sound thresholds (yellow at 1:30, red at 2:00) retained.

## Run

Use Node.js 20 or newer; no packages to install.

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. Any static server can host `dist/`. To enable the included GitHub Pages workflow, select GitHub Actions in repository Settings → Pages.

## Controls

- **Add Car / 1** adds a car at Entry. It advances to Order when clear.
- **Order Complete / Q** releases the car. It moves one space per second when the next space is clear, until reaching Window.
- **Window Complete / P** releases the car and records its result on the next tick.
- **Fullscreen Mode / F** shows the scoreboard and map; keyboard controls remain available.
- **Enable Sounds** unlocks Brighton's original audio. **Test All Sounds** plays the single entry sound, yellow warning and double red warning.
- **Reset Day** clears cars and results after a confirmation dialog, as in Brighton.

Only completed cars affect averages. Window timing starts on reaching Window; 60 seconds or less is on target. Brighton's average colours remain: green below target, yellow from target through 1.5 times target, then red. Total timing starts when the car leaves Order, as in Brighton.

State is stored in this browser under a Harmony-specific key, separate from Brighton and the earlier prototype. Operate from one tab/device. Like Brighton, the simulation clock runs while the page is open; time while closed is not added, and background browser throttling can slow ticks. Counts accumulate until Reset Day, with no automatic daypart reset. The clock display uses the device timezone.

## Verify

```sh
node --check dist/app.js
node --test
```

Tests cover capacity, FIFO movement and blocking, manual releases, the 60-second Window boundary, completed-only statistics, state restoration, warnings, reset and removed UI controls. The browser embeds `dist/simulation.mjs` without module exports; a regression test verifies agreement between these copies.
