# GolfCompanion

GolfCompanion is a modern Expo-powered app designed to enhance your golfing experience with score tracking, course management, and performance analytics—all built with TypeScript and React Native.

---

## Features

- **Score Tracking:** Track scores and progress across rounds.
- **Course Management:** Add/manage favorite courses with custom details.
- **Statistics:** Analyze performance with detailed stats and visualizations.
- **Customizable Settings:** Personalize the app to your playing style.
- **User-Friendly Interface:** Clean, responsive UI.

---

## Tech Stack

- **Expo** — App runtime & build tools
- **React Native** — Mobile app framework
- **TypeScript** — Main application logic & UI
- **JavaScript** — Supplementary scripts

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14+)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)

### Installation

```bash
git clone https://github.com/HarrisonKN/GolfCompanion.git
cd GolfCompanion
npm install
```

### Running the App (Development)

```bash
npm start
# or
npx expo start
```

You can open the app in:
- [Expo Go](https://expo.dev/go)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Development build](https://docs.expo.dev/develop/development-builds/introduction/)

Edit files in the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

---

## Building & Publishing

### Build for Production

```bash
npm run build
# or for Expo:
expo build:android
expo build:ios

#or for my method
npx expo run:android

cd .\android\
.\gradlew.bat assembleRelease

```

---

## Versioning & Updates

GolfCompanion uses semantic versioning (major.minor.patch).

**To update the version:**

You can update the version manually or use the automated scripts:

- **Manual:**  
  1. Edit `expo.version` in `golf-companion/app.json`.
  2. Commit and push your changes:
     ```bash
     git add .
     git commit -m "chore: bump version"
     git push
     ```

- **Automated:**  
  Use one of the following npm scripts to bump the version:
  ```bash
  npm run version:patch   # For a patch update (bugfixes, small changes)
  npm run version:minor   # For a minor update (new features, backwards compatible)
  npm run version:major   # For a major update (breaking changes)

---

## Learn More

- [Expo documentation](https://docs.expo.dev/)
- [Expo guides](https://docs.expo.dev/guides)
- [Expo tutorial](https://docs.expo.dev/tutorial/introduction/)

---

## Community & Contributing

- [Expo on GitHub](https://github.com/expo/expo)
- [Expo Discord](https://chat.expo.dev)
- Open issues or submit pull requests to help improve GolfCompanion.

---

## License

MIT License. See [LICENSE](LICENSE).

---

## Contact

Questions or feedback? [@HarrisonKN](https://github.com/HarrisonKN)

---

Enjoy your golf game with GolfCompanion! 🏌️‍♂️⛳

AI'd the fuck out of this README lolz
