### 🚀 What's New in v1.0.4

#### ⚡ Server-Side Data Loading & Instant Navigation
- **Body Composition & Physique Hub**: Migrated to Server-Side Pre-Rendering with React Suspense for zero-latency loading of weight trends, body fat history, and AI physique analyses.
- **Workout Builder & Active Gym Recorder**: Added preloaded server components for seamless exercise library access and instant routine logging.
- **Modular Admin Portal Architecture**: High-speed server data fetching across Admin Dashboard, Exercise Database, Nutrition Management, and User Administration.

#### 🎨 Comprehensive UI/UX Design & Accessibility Upgrade
- **Clean Google-Style Aesthetics & Glassmorphism**: Refined surfaces with subtle glassmorphic panels (`glass-surface`, `glass-panel`) and crisp elevations while maintaining our signature dark color palette.
- **WCAG 2.1 AA Keyboard Accessibility**: Enforced high-contrast `:focus-visible` focus indicators across all buttons, inputs, links, select dropdowns, and tab controls for seamless accessibility.
- **Tabular Figures (`tabular-nums`)**: Implemented jitter-free tabular numbers across gym rest timers, weight inputs, calorie readouts, and charts.
- **Mobile Touch Target Optimization**: Enforced standard 44px–48px minimum touch targets across all interactive buttons, inputs, selectors, and tabs for effortless one-handed mobile use.
- **Responsive Mobile Admin Navigation**: Introduced a responsive mobile navigation header and menu drawer for the Admin Control Panel (`/admin/*`), allowing seamless management on mobile devices.
- **Workout Logging & Live Rest Timer Polish**: Added `role="timer"` with `aria-live="polite"` screen-reader announcements for active gym rest countdowns, explicit input accessibility labels on sets, and clear warmup indicators.
- **Auth Form Enhancements**: Integrated accessible password visibility toggles (Show/Hide Password) with full autocomplete support on Sign In and Sign Up screens.
- **Motion & Edge-to-Edge Safe Areas**: Added `@media (prefers-reduced-motion: reduce)` support and optimized safe-area padding for edge-to-edge mobile displays.