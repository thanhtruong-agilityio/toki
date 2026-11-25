import { verifyPrototype } from "./prototype";

// The global setup of the parity config (R17): every run, whichever files it runs, compares the
// prototype copy with its recorded hash first and stops with "the prototype changed: make the
// references again and record the new hash".
export default function globalSetup(): void {
  verifyPrototype();
}
