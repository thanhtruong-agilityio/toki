// Control characters (0 to 31 and 127), found by code so that no pattern holds one.
const isControl = (code: number) => code < 32 || code === 127;

export function hasControl(value: string): boolean {
  for (let i = 0; i < value.length; i++)
    if (isControl(value.charCodeAt(i))) return true;
  return false;
}

// Runs of control characters become one space (R12).
export function controlToSpace(value: string): string {
  let out = "";
  let inRun = false;
  for (let i = 0; i < value.length; i++) {
    if (isControl(value.charCodeAt(i))) {
      if (!inRun) out += " ";
      inRun = true;
    } else {
      out += value[i];
      inRun = false;
    }
  }
  return out;
}
