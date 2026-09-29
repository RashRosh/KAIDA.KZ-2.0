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
import { LanguageGate } from '../seller/_kaida/language-gate';

// buyer-screens-mockup: the buyer screens are built from the accepted mockup (B01, B02) and its classes, in the same
// phone column as the seller app; the language is chosen once at the first visit.
export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return <LanguageGate>{children}</LanguageGate>;
}
