/// <reference types="electron-vite/node" />

/**
 * electron-vite exposes any `MAIN_VITE_`-prefixed variable from .env on
 * import.meta.env in the main process. Declaring it here is what stops the
 * client ID from having to be read through an untyped cast.
 */
interface ImportMetaEnv {
  readonly MAIN_VITE_SPOTIFY_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
