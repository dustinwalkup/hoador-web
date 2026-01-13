# PWA Cross-Browser Compatibility

This document outlines browser-specific behaviors, limitations, and testing results for the Hoador PWA implementation.

## Browser Support Matrix

| Browser           | Service Worker | Install Prompt | Push Notifications | Background Sync | Network Info |
| ----------------- | -------------- | -------------- | ------------------ | --------------- | ------------ |
| Chrome (Desktop)  | ✅             | ✅             | ✅                 | ✅              | ✅           |
| Chrome (Android)  | ✅             | ✅             | ✅                 | ✅              | ✅           |
| Edge (Desktop)    | ✅             | ✅             | ✅                 | ✅              | ✅           |
| Edge (Android)    | ✅             | ✅             | ✅                 | ✅              | ✅           |
| Firefox (Desktop) | ✅             | ❌             | ✅                 | ⚠️              | ❌           |
| Firefox (Android) | ✅             | ❌             | ✅                 | ⚠️              | ❌           |
| Safari (macOS)    | ✅             | ❌\*           | ⚠️                 | ❌              | ❌           |
| Safari (iOS)      | ✅             | ❌\*           | ⚠️                 | ❌              | ❌           |
| Samsung Internet  | ✅             | ✅             | ✅                 | ✅              | ✅           |

\*Safari requires manual installation via Share menu

## Feature Detection

The app uses feature detection to gracefully degrade when features are not supported:

- **Service Workers**: Core PWA feature, required for offline functionality
- **Install Prompt**: Automatic install prompt (Chrome, Edge, Samsung)
- **Manual Install**: Safari requires manual installation
- **Push Notifications**: Supported in most browsers (varies by platform)
- **Background Sync**: Limited support (Chrome, Edge, Samsung)
- **Network Information API**: Limited support (Chrome, Edge, Samsung)

## Browser-Specific Behaviors

### Chrome / Edge (Desktop & Mobile)

**Full Support:**

- ✅ Service worker registration
- ✅ Automatic install prompt (`beforeinstallprompt` event)
- ✅ Push notifications
- ✅ Background sync
- ✅ Network Information API
- ✅ Offline functionality

**Installation:**

- Automatic install prompt appears when PWA criteria are met
- Users can also install via browser menu (three dots > Install app)

### Firefox (Desktop & Mobile)

**Partial Support:**

- ✅ Service worker registration
- ✅ Offline functionality
- ✅ Push notifications
- ❌ Install prompt API (not supported)
- ⚠️ Background sync (experimental)
- ❌ Network Information API

**Installation:**

- Manual installation via browser menu (three lines > Install)
- No automatic install prompt

**Limitations:**

- Some PWA features may have limited support
- Background sync is experimental and may not work reliably

### Safari (macOS)

**Partial Support:**

- ✅ Service worker registration
- ✅ Offline functionality
- ⚠️ Push notifications (requires user permission, limited support)
- ❌ Install prompt API (not supported)
- ❌ Background sync
- ❌ Network Information API

**Installation:**

- Manual installation via Share menu
- Click Share button > "Add to Dock" or "Add to Home Screen"

**Limitations:**

- No automatic install prompt
- Push notifications require explicit user permission
- Some advanced features may not be available

### Safari (iOS)

**Partial Support:**

- ✅ Service worker registration
- ✅ Offline functionality
- ⚠️ Push notifications (requires user permission, limited support)
- ❌ Install prompt API (not supported)
- ❌ Background sync
- ❌ Network Information API

**Installation:**

- Manual installation via Share menu
- Tap Share button (square with arrow) > "Add to Home Screen"

**Limitations:**

- No automatic install prompt
- Push notifications require explicit user permission
- Service worker has some limitations (e.g., no background sync)
- Some advanced features may not be available

**iOS-Specific Notes:**

- Uses `navigator.standalone` property to detect installation
- Standalone mode detection via `matchMedia('(display-mode: standalone)')`
- Service worker works but with some limitations

### Samsung Internet

**Full Support:**

- ✅ Service worker registration
- ✅ Automatic install prompt
- ✅ Push notifications
- ✅ Background sync
- ✅ Network Information API
- ✅ Offline functionality

**Installation:**

- Automatic install prompt (similar to Chrome)
- Manual installation via menu

**Notes:**

- Generally has good PWA support
- Behavior similar to Chrome but may have minor differences

## Testing Checklist

### Chrome / Edge

- [ ] Service worker registers successfully
- [ ] Install prompt appears automatically
- [ ] Offline functionality works
- [ ] Update notifications work
- [ ] Network status detection works
- [ ] Cache strategies work correctly

### Firefox

- [ ] Service worker registers successfully
- [ ] Manual installation works
- [ ] Offline functionality works
- [ ] Update notifications work
- [ ] Graceful degradation for unsupported features

### Safari (macOS)

- [ ] Service worker registers successfully
- [ ] Manual installation works
- [ ] Offline functionality works
- [ ] Installation instructions display correctly
- [ ] Standalone mode detection works

### Safari (iOS)

- [ ] Service worker registers successfully
- [ ] Manual installation works (Add to Home Screen)
- [ ] Offline functionality works
- [ ] Installation instructions display correctly
- [ ] Standalone mode detection works (`navigator.standalone`)
- [ ] App works in standalone mode

### Samsung Internet

- [ ] Service worker registers successfully
- [ ] Install prompt appears automatically
- [ ] Offline functionality works
- [ ] All features work as expected

## Known Issues and Workarounds

### Safari Install Prompt

**Issue:** Safari doesn't support `beforeinstallprompt` event.

**Workaround:**

- Show manual installation instructions
- Detect Safari and display step-by-step guide
- Use `navigator.standalone` to detect if already installed on iOS

### Firefox Background Sync

**Issue:** Background sync is experimental and may not work reliably.

**Workaround:**

- Use offline queue as fallback
- Don't rely on background sync for critical operations

### Network Information API

**Issue:** Not supported in Safari and Firefox.

**Workaround:**

- Use `navigator.onLine` as fallback
- Gracefully degrade when API is not available

## Feature Detection Usage

The app uses `src/lib/pwa/feature-detection.ts` to detect browser capabilities:

```typescript
import {
  detectBrowser,
  getPWAFeatureSupport,
  shouldEnableFeature,
} from "@/lib/pwa/feature-detection";

// Detect browser
const browser = detectBrowser();
console.log(browser.name); // "chrome", "safari", "firefox", etc.

// Check feature support
const support = getPWAFeatureSupport();
if (support.installPrompt) {
  // Show automatic install prompt
} else if (browser.name === "safari") {
  // Show manual installation instructions
}

// Check if feature should be enabled
if (shouldEnableFeature("backgroundSync")) {
  // Enable background sync
}
```

## Best Practices

1. **Always use feature detection** before using PWA features
2. **Provide fallbacks** for unsupported features
3. **Test on multiple browsers** before deploying
4. **Document browser-specific behaviors** for users
5. **Gracefully degrade** when features are not available

## Resources

- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN: Web App Manifests](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Can I Use: Service Workers](https://caniuse.com/serviceworkers)
- [Can I Use: Web App Manifest](https://caniuse.com/web-app-manifest)
- [PWA Browser Support](https://web.dev/pwa-browser-support/)
