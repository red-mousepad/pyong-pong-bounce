# Pyong! Bounce

Build a web application inspired by the bouncing square screen effect with interactive gameplay, custom sound effects, ad banner placeholder, and an in-app purchase logic ($0.99).

Please follow these exact requirements and specifications:

1. Initial Screen Setup & Mechanics:

- Background: Fullscreen black (#000000).

- Object: A yellow square placed at the exact center of the screen initially.

- Start Action: Touching/clicking the central square triggers a cute "Pyong!" (뿅!) sound effect (generated dynamically using Web Audio API or clean synthesizer audio), and the square begins moving continuously in a random straight-line vector direction.

- Bouncing Logic: The square moves at a constant straight trajectory and bounces off screen edges infinitely.

2. Color Changing & Corner Collision Rules:

- Wall Bounce Color: Every time the square hits a wall/edge, its color changes to a random distinct color (must be different from the color before the hit). Play a short, crisp "Tong" (통) bounce sound effect.

- Corner Hit (Exact Match): When the square hits the exact right-angle corner of the screen:

  - The square's border turns into a glowing gold / metallic gold aura.

  - This golden border remains active until the square hits the next wall/edge.

  - Trigger a cute fireworks/whistle sound effect ("Piyong!" / 피용!).

  - Increment the central hit counter by +1.

3. Central Counter Display:

- Display a large, clean number in the center background of the screen.

- Starts at 0.

- Increments by 1 every time an exact corner collision occurs.

4. Pause & Controls:

- Tapping/clicking the moving square pauses the movement and sound.

- Show an overlay with two clear action buttons: "계속" (Resume) and "리셋" (Reset).

- "계속" (Resume): Unpauses the game, resuming movement, color, direction, and score exactly from where it was paused.

- "리셋" (Reset): Resets the score to 0, moves the yellow square back to the center, and restores the initial start state.

5. Sound & Audio System (Web Audio API):

- Built-in synthetic audio effects using Web Audio API so no external asset files are required:

  - Start tap: Cute "Pyong!" (뿅!) sound.

  - Wall bounce: Short "Tong!" (통) sound.

  - Corner hit: Cute fireworks "Piyong!" (피용!) sound.

6. Ads & In-App Purchase ($0.99) Logic:

- Position an Ad Banner placeholder directly below the central score number during gameplay.

- Right beside or below the ad banner, include an "광고 없애기 ($0.99)" (Remove Ads) button.

- Clicking "광고 없애기 ($0.99)" opens a sleek modal simulating/handling an In-App Purchase flow (Stripe or mock payment sheet for $0.99).

- Once purchased, permanently hide the ad banner and the "Remove Ads" button, and persist this state in LocalStorage so ads remain removed on refresh.

7. General UI & Responsiveness:

- Clean, modern, responsive layout fitting mobile and desktop screens.

- Ensure screen wake lock prevents the device display from turning off automatically while playing.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4a731870-df99-453a-a1d1-56bd33531ca4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
