import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/geologica/400.css';
import '@fontsource/geologica/500.css';
import '@fontsource/geologica/600.css';
import '@fontsource/geologica/700.css';
import '../seller/kaida.css';
import '../seller/kaida-app.css';
import './_ui/first-entry.css';

// Shared legacy runtime support; new visual authority is docs/product/DESIGN_BASELINE.md, migrated per slice.
// No language screen intercepts a route: the language is the saved choice, else the
// browser's, else Russian (stage 6B).
export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
