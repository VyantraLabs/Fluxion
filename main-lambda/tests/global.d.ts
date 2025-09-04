/**
 * Global type declarations for Jest testing
 */

declare global {
  namespace NodeJS {
    interface Global {
      mockDate: (date: string) => Date;
      restoreDate: () => void;
    }
  }

  var mockDate: (date: string) => Date;
  var restoreDate: () => void;
}

export {};