import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/geologica/400.css';
import '@fontsource/geologica/500.css';
import '@fontsource/geologica/600.css';
import '@fontsource/geologica/700.css';
import './kaida.css';
import './kaida-app.css';

// seller-showcase-editor: the seller screens are the accepted mockup (PROJECT_RULES.md §18.1) one to one — its
// stylesheet, icons and fonts (Roboto, Geologica), served from this app. No language screen intercepts a route
// (stage 6B): the language is the saved choice, else the browser's, else Russian.
export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
