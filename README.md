# Harmony Drive Thru Timer

A manual, single-lane drive thru timer for Harmony. The lane has **Order → queue → Window → exit**. There is no cash window. The **Window target is 60 seconds**, measured from “Move to Window” to “Car leaves”.

## Run

Requires Node.js 20 or newer; there are no packages to install.

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. Alternatively serve `dist/` from any static web host. Use an HTTP server rather than opening the HTML file directly because the application uses JavaScript modules.

## Operate

1. **Car arrives (A)** adds a car at Order and starts its journey timer. Only one car can occupy Order.
2. **Order complete (O)** moves the car to the waiting queue, freeing Order for another arrival.
3. **Move to Window (W)** moves the oldest queued car to the available Window and starts its 60-second timer.
4. **Car leaves (L)** records the Window time and total journey time, and frees the Window. Move the next queued car separately when it actually arrives at the Window.

The Window is green below 45 seconds, amber from 45 through 60 seconds, and red above 60 seconds. A recorded Window time of exactly 60 seconds is on target. The Order bubble displays time since arrival. Queued cars retain their identity and arrival times. Overflow is shown as a waiting count.

**Undo last action** reverses one action, including an accidental departure, retaining original timestamps. Undo is available until the next action, page reload, or update from another tab. Full screen works where supported by the browser. Shortcuts are ignored when a button or editable field has focus; use the focused button with Enter or Space.

## Results and storage

The dashboard shows completed cars, average Window duration, and percentage on target for the current daypart. Default dayparts, based on the device’s local clock:

| Daypart | Time |
| --- | --- |
| Overnight | 00:00–04:59 |
| Breakfast | 05:00–10:59 |
| Lunch | 11:00–14:59 |
| Dinner | 15:00–23:59 |

Results belong to the date and daypart when the car leaves. Active cars carry over daypart and midnight boundaries. Change `daypart()` in `dist/timer.js` to match store reporting periods. Set the store device to the correct timezone and keep its clock accurate.

Active cars and completed results are saved in **this browser’s local storage**, with no shared server or cross-device sync. A refresh restores original timestamps. Clearing browser data removes records; export regularly. Private browsing or storage restrictions can prevent saving; a warning appears in the footer. Unreadable stored data is preserved rather than overwritten; export any newly recorded results before closing and investigate the stored data before resetting it. There is no automatic retention deletion. Two tabs receive storage updates, but simultaneous actions are not transactional: operate from **one tab on one device**.

**View activity** lists today’s departures. **Export today** downloads a CSV of all today’s completed cars, with ISO timestamps in UTC and durations in seconds. Displayed times use local time. Percentages use full elapsed milliseconds; duration displays truncate to whole seconds.

This version uses manual controls only, with no sensor or camera integration.

## Verify

```sh
node --test
```

Tests cover FIFO movement, occupied stations, the exact 60-second boundary, independent Window and journey durations, daypart/date rollover, and restoring active cars.

## Hosting

Publish the contents of `dist/` to a static host. The GitHub Actions workflow checks the timer and deploys to GitHub Pages. In repository Settings → Pages, select **GitHub Actions** as the source to enable that workflow. The `.openai/hosting.json` file additionally identifies the private Sites preview.
