import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/geologica/600.css';
import '@fontsource/geologica/700.css';

// seller-showcase-editor: fonts of the accepted mockup look (PROJECT_RULES.md §18.1), served from this app, not a third
// party. The look itself is applied by the cabinet frame, so the shared app header stays as on the buyer screens.
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
