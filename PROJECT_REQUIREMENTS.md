# PROJECT REQUIREMENTS: Local Dev Environment Dashboard

## 1. Project Overview

**Goal:** Develop an Electron.js desktop application using the `electron-react-boilerplate` to serve as a centralized dashboard for managing local software development projects. The application will allow users to define projects, execute common scripts, manage `.env` files through in-app editing, and perform quick actions like opening projects in an IDE or terminal.

**Core User Pain Points Addressed:**
*   Reducing context switching between multiple projects.
*   Streamlining repetitive command-line tasks.
*   Simplifying the management and editing of environment variables.
*   Providing a quick overview and access point for local development tasks.

## 2. Core Technologies & Architecture

*   **Framework:** Electron.js
*   **UI Library:** React.js
*   **Boilerplate:** `electron-react-boilerplate` (This structure should be adhered to for main/renderer process separation, build configurations, and IPC).
*   **State Management (Renderer):** React Context API or a simple state management solution suitable for the boilerplate (e.g., Zustand, or stick to component state if sufficient for MVP).
*   **Persistent Storage:** `electron-store` for storing application settings, project configurations, and user preferences in the main process.
*   **Inter-Process Communication (IPC):** Utilize Electron's IPC mechanisms (`ipcMain`, `ipcRenderer`, preload scripts as per boilerplate best practices) for all communication between the main process (Node.js capabilities) and the renderer process (React UI).
*   **Node.js APIs (Main Process):**
    *   `child_process` (specifically `spawn` for script execution and `exec` for simpler commands like opening IDE/terminal).
    *   `fs` (for reading, writing, backing up `.env` files, checking paths).
    *   `dialog` (for folder selection).
    *   `shell` (for opening folders in file explorer).
*   **Environment Variable Parsing:** Use a library like `dotenv` for parsing `.env` files (can be used in the main process or its parsing logic adapted).

## 3. MVP Feature Requirements

### 3.1. Project Management & Overview

*   **FR1.1: Add New Project**
    *   **UI:** Button to initiate "Add Project." Modal/form to input "Project Name."
    *   **Action:** Use Electron's `dialog.showOpenDialog({ properties: ['openDirectory'] })` to allow the user to select the project's root folder path.
    *   **Storage:** Store project details (name, path) persistently using `electron-store`.
*   **FR1.2: List Projects**
    *   **UI:** Display all added projects in a primary view (e.g., a list or grid of cards). Each project entry should display its name.
    *   **Interaction:** Allow selecting a project to view its details and associated actions (scripts, .env editor). Clearly indicate the currently active/selected project.
*   **FR1.3: Remove Project**
    *   **UI:** Button/option associated with each project in the list to "Remove Project."
    *   **Action:** Confirm removal. Upon confirmation, remove the project's configuration from `electron-store`. This does NOT delete the project from the file system.
*   **FR1.4: Data Persistence**
    *   **Requirement:** All project configurations (name, path, defined scripts, associated environment variables if managed internally beyond just the `.env` file) must be saved to and loaded from `electron-store` on application start/close.

### 3.2. Script Execution & Control (Per Selected Project)

*   **FR2.1: Define Custom Scripts**
    *   **UI:** In the context of a selected project, provide an interface to define multiple custom scripts. Each script definition requires:
        *   A user-friendly "Script Name" (e.g., "Start API Server," "Run Frontend Tests").
        *   The exact "Command" string to execute (e.g., `npm run dev`, `yarn test`, `python manage.py runserver`).
    *   **Storage:** Script definitions should be stored as part of the project's configuration in `electron-store`.
*   **FR2.2: Execute Scripts**
    *   **UI:** For each defined script, display a "Run" button.
    *   **Action (Main Process):**
        *   Execute the script using `child_process.spawn(command, args, { cwd: projectPath, shell: true })`. Ensure `cwd` is set to the project's root path. Using `shell: true` can be convenient but be mindful of security if commands are ever constructed from user input that isn't sanitized (less of a concern here as the user defines their own commands).
        *   Keep track of the `ChildProcess` object for each running script to enable stopping it.
*   **FR2.3: View Script Output**
    *   **UI:** A dedicated, scrollable area (e.g., a simple terminal-like panel) within the application to display real-time `stdout` and `stderr` from the currently executing script.
    *   **IPC:** Stream `stdout` and `stderr` data from the main process to the renderer process for display.
*   **FR2.4: Stop Scripts**
    *   **UI:** If a script is running, its "Run" button should change to a "Stop" button (or a separate "Stop" button should become active).
    *   **Action (Main Process):** When "Stop" is clicked, use the stored `ChildProcess` object's `.kill()` method (e.g., `child.kill('SIGTERM')`, potentially followed by `SIGKILL` if it doesn't terminate) to stop the script.
    *   **Feedback:** Update the UI to reflect that the script has stopped or the stop attempt was made.

### 3.3. In-App Environment Variable (.env) Editing (Per Selected Project)

*   **FR3.1: Load and View `.env` File**
    *   **Action (Main Process):** On project selection, check for a `.env` file in the project's root.
    *   **IPC & UI:** If found, read its content, parse it into key-value pairs (e.g., using `dotenv.parse`), and send to the renderer. The UI should display these pairs in an editable format (e.g., a list of input fields for keys and corresponding values). If not found, display an empty editor or an option to create one.
*   **FR3.2: Edit Key-Value Pairs**
    *   **UI:** Allow users to:
        *   Add new key-value pairs.
        *   Modify existing keys and/or values.
        *   Delete existing key-value pairs.
*   **FR3.3: Save `.env` File**
    *   **UI:** A "Save .env" button.
    *   **Action (Main Process):**
        1.  **Backup:** Before overwriting, create a backup of the current `.env` file (e.g., copy to `.env.bak-[timestamp]` or `.env.bak`).
        2.  **Write:** Construct the `.env` file content from the UI's key-value pairs and write it to the `project-root/.env` file using `fs.writeFile`.
    *   **Feedback:** Provide success or error feedback to the user via the UI.

### 3.4. Quick Actions (Per Selected Project)

*   **FR4.1: Open Project in IDE**
    *   **UI:** A button "Open in IDE."
    *   **Configuration:** A global application setting (stored in `electron-store`) where the user can define the command to launch their preferred IDE (e.g., `code` for VS Code, `idea` for IntelliJ, full path to executable if needed). Default to `code` if not set.
    *   **Action (Main Process):** Execute `[IDE_COMMAND] [PROJECT_PATH]` using `child_process.exec` or `spawn`.
*   **FR4.2: Open Project Folder**
    *   **UI:** A button "Open Folder."
    *   **Action (Main Process):** Use `shell.openPath(projectPath)`.
*   **FR4.3: Open Project in Native Terminal**
    *   **UI:** A button "Open in Terminal."
    *   **Action (Main Process):** Execute the OS-specific command to open a new terminal window at the `projectPath`.
        *   macOS: `open -a Terminal "${projectPath}"`
        *   Windows: `start cmd /K "cd /d ${projectPath}"` (or Powershell equivalent)
        *   Linux: `gnome-terminal --working-directory="${projectPath}"` (or other common terminal commands like `konsole`, `xfce4-terminal`). The app might need a setting to choose the preferred Linux terminal or attempt to detect it.

## 4. Non-Functional Requirements (MVP)

*   **NFR1: Usability:** The application should be intuitive and easy to navigate for the defined MVP features.
*   **NFR2: Stability:** Core operations (project management, script execution/stopping, .env saving) must be reliable. Proper error handling for file operations and process management.
*   **NFR3: Feedback:** The application must provide clear visual feedback for user actions (e.g., "Script Started," ".env Saved," "Error: File not found").
*   **NFR4: Adherence to Boilerplate:** Follow the patterns and structure of `electron-react-boilerplate` for maintainability and leveraging its features.

## 5. Future Enhancements (Post-MVP)

*   Multiple named environment configurations per project (e.g., `.env.dev`, `.env.staging`) with easy switching.
*   Advanced script management (status indicators on project list, output history, color-coded output, multiple concurrent script views).
*   Git integration (current branch display, quick actions).
*   Docker integration (quick actions for `docker-compose.yml`).
*   Global settings page UI (for IDE command, terminal preferences, themes).
*   System tray icon and native notifications.
*   Enhanced terminal emulation using `xterm.js`.
*   Project grouping, tagging, and searching.
*   Auto-update functionality.

---

This document outlines the initial requirements for the Local Dev Environment Dashboard. The AI agent should focus on implementing the MVP features first, ensuring each functional requirement (FR) is met and adheres to the specified architecture and non-functional requirements (NFR).