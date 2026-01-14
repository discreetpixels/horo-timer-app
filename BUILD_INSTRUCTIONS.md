# Ruby10 App: Build and Packaging Instructions for macOS

This document provides instructions on how to build the Ruby10 Electron application and package it into a `.app` bundle and then a `.dmg` installer for macOS. You will need Node.js and npm installed on your macOS machine.

## Prerequisites

1.  **Node.js and npm:** Ensure you have Node.js (which includes npm) installed. You can download it from [nodejs.org](https://nodejs.org/).
2.  **Xcode Command Line Tools:** These are required for `electron-builder`. Install them by running `xcode-select --install` in your macOS Terminal.

## Step-by-Step Instructions

### 1. Download the Application Files

Download all the provided files into a single directory on your macOS machine. Let's assume this directory is named `ruby10-app`.

### 2. Navigate to the Application Directory

Open your Terminal application (you can find it in `Applications/Utilities/Terminal.app`) and navigate to the `ruby10-app` directory using the `cd` command:

```bash
cd /path/to/your/ruby10-app
```

(Replace `/path/to/your/ruby10-app` with the actual path to where you saved the files, e.g., `cd ~/Downloads/ruby10-app`)

### 3. Install Dependencies

Once in the directory, install the necessary Node.js dependencies:

```bash
npm install
```

This command will read the `package.json` file and install Electron and `electron-builder`.

### 4. Run the Application (Optional)

To test the application before packaging, you can run it directly:

```bash
npm start
```

This will launch the Electron app. You should see the Ruby10 icon appear in your macOS menu bar.

### 5. Build the macOS Application (.app)

To create a distributable `.app` bundle, run the build command:

```bash
npm run build
```

This command will compile your Electron application and place the `.app` bundle in a `dist` folder within your `ruby10-app` directory (e.g., `dist/Ruby10.app`).

### 6. Package as a Disk Image (.dmg)

To create a `.dmg` installer file, which is common for macOS application distribution, run:

```bash
npm run build:dmg
```

This command will also place the `.dmg` file in the `dist` folder (e.g., `dist/Ruby10-1.0.0.dmg`). You can then open this `.dmg` file and drag the `Ruby10.app` into your Applications folder to install it.

## Application Files Provided

*   `main.js`: The main Electron process script.
*   `index.html`: The user interface for the pop-out panel.
*   `styles.css`: Styles for the user interface.
*   `renderer.js`: The renderer process script for UI logic.
*   `package.json`: Project configuration and build settings.
*   `assets/icon.png`: The application icon.

---

**Note:** The `electron-builder` configuration in `package.json` is set up to create a `.dmg` file with a simple drag-and-drop installation experience. If you encounter any issues, please ensure all prerequisites are met and follow the steps carefully.
