import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/geologica/400.css';
import '@fontsource/geologica/500.css';
import '@fontsource/geologica/600.css';
import '@fontsource/geologica/700.css';
import './kaida.css';
import './kaida-app.css';

// Shared legacy runtime support; new visual authority is docs/product/DESIGN_BASELINE.md, migrated per slice.
// Existing stylesheet/icons/fonts remain until their surface migrates. No language screen intercepts a route
// (stage 6B): the language is the saved choice, else the browser's, else Russian.
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
