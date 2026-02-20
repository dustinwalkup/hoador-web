# PWA Implementation Requirements

## Introduction

This document defines the requirements for the Hoador web application's Progressive Web App (PWA) capabilities. The implementation has been trimmed to focus on core installability: a web app manifest, manual install instructions, and meta tags that enable users to add the app to their home screen or install it as a standalone application. The app can be installed on iOS (Safari), Android (Chrome), and desktop browsers.

There is no service worker, offline support, or automatic install prompt (`beforeinstallprompt`). Those features are listed as future enhancements. Push notifications are specified separately in [specs/pwa-push-notifications/1-requirements.md](../pwa-push-notifications/1-requirements.md) and will require implementing a minimal service worker as part of that feature.

## Requirements

### Requirement 1: Web App Manifest

**User Story:** As a user, I want to install the Hoador app on my device, so that I can access it quickly like a native app.

#### Acceptance Criteria

1. WHEN the app is loaded THEN the system SHALL provide a valid web app manifest file at `/site.webmanifest`
2. The system SHALL include the following manifest properties:
   - `name`: Application name
   - `short_name`: Short name for home screen
   - `description`: Application description
   - `start_url`: "/" (entry point when launched from home screen)
   - `display`: "standalone" (full-screen experience without browser UI)
   - `theme_color`: Theme color for status bar
   - `background_color`: Background color for splash screen
   - `orientation`: "portrait-primary" (preferred orientation)
3. The system SHALL include properly sized icons (192x192 and 512x512 PNG)
4. The system SHALL link the manifest in the HTML `<head>` with `<link rel="manifest">`
5. The system SHALL include iOS-specific meta tags for Apple devices:
   - `apple-mobile-web-app-capable`
   - `apple-mobile-web-app-status-bar-style`
   - `apple-mobile-web-app-title`

### Requirement 2: Manual Install Instructions

**User Story:** As a user, I want instructions for installing the app on my device, so that I can add Hoador to my home screen even when my browser does not show an automatic install prompt.

#### Acceptance Criteria

1. The system SHALL provide device- and browser-specific install instructions
2. Instructions SHALL be available for: iOS Safari, macOS Safari, Android Chrome, Desktop Chrome/Edge
3. The system SHALL detect the user's browser and platform to show relevant instructions
4. The system SHALL provide a manual install option in the app (e.g., preferences page)
5. The system SHALL NOT rely on the `beforeinstallprompt` event (not all browsers/situations support it)
6. The system SHALL support dismissal of the install prompt (permanently or "remind later")
7. WHERE the app is already installed (standalone mode) THEN the system SHALL not show install instructions

### Requirement 3: Install Status and Standalone Detection

**User Story:** As a user, I want the app to know when I have installed it, so that I am not repeatedly shown install prompts.

#### Acceptance Criteria

1. The system SHALL detect when the app is running in standalone mode (installed PWA)
2. The system SHALL use `window.matchMedia("(display-mode: standalone)")` for standalone detection
3. The system SHALL support iOS Safari's `navigator.standalone` for standalone detection
4. The system MAY persist installation status in localStorage for edge cases
5. WHERE the app is installed THEN the system SHALL not show install prompts or instructions

### Requirement 4: PWA Meta Tags and Branding

**User Story:** As a user, I want the installed app to have proper branding and appearance, so that it feels like a native application.

#### Acceptance Criteria

1. The system SHALL include `theme-color` meta tag for the status bar
2. The system SHALL include `mobile-web-app-capable` for mobile browsers
3. The system SHALL include Apple-specific meta tags for iOS
4. The system SHALL include iOS splash screen images for common device sizes (optional but recommended)
5. The system SHALL include an apple-touch-icon for home screen icon

### Requirement 5: Install Directions Banner

**User Story:** As a user, I want to be prompted to install the app when appropriate, so that I can discover the install option.

#### Acceptance Criteria

1. The system SHALL display an install directions banner (or similar) to uninstalled users
2. The banner SHALL be dismissible (permanently or temporarily)
3. The banner SHALL not display when the app is already installed
4. The banner SHALL not display when the user has dismissed it (according to dismissal logic)
5. "Remind later" dismissals SHALL expire after a configurable period (e.g., 7 days)

## Non-Functional Requirements

### Security

1. PWA features SHALL only be fully enabled over HTTPS in production
2. The manifest and icons SHALL be served from the same origin

### Usability

1. Install instructions SHALL be clear and device-appropriate
2. The install flow SHALL not block or interrupt core application usage

## Assumptions

1. The application is served over HTTPS in production
2. The application uses Next.js App Router architecture
3. Users on iOS primarily use Safari; users on Android primarily use Chrome
4. Standalone detection works in supported browsers

## Constraints

1. The `beforeinstallprompt` event is not used; install is manual-only
2. No service worker means no offline support or background sync
3. iOS Safari has different install flow than Android Chrome
4. Some browsers do not support all PWA features

## Out of Scope (Future Enhancements)

1. **Push notifications** (see [specs/pwa-push-notifications/1-requirements.md](../pwa-push-notifications/1-requirements.md) - requires service worker)
2. **Service worker** - For offline support and push; to be implemented with push notifications feature
3. **Offline support and caching** - Requires service worker
4. **beforeinstallprompt / automatic install prompt** - Not all browsers/situations support it; manual flow is sufficient
5. **Background sync API** for offline form submissions
6. **Share Target API** for receiving shared content
7. **Periodic background sync**
8. **Web Share API** integration
9. **Badge API** for unread notifications
10. **Lighthouse PWA score** - Full PWA score requires service worker; not a current goal

## Success Criteria

1. Users can install the app on their devices (iOS, Android, desktop) via manual instructions
2. The web app manifest is valid and linked
3. Installed app opens in standalone mode without browser UI
4. Install prompts can be dismissed and do not re-appear inappropriately
5. Standalone/installed status is detected correctly
