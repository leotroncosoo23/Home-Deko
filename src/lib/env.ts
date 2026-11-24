import "server-only";

/**
 * Lee una variable de entorno obligatoria del servidor. Si falta, el error
 * dice CUÁL falta (nunca muestra valores).
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}
