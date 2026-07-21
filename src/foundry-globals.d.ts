/**
 * Minimal declarations for the Foundry VTT globals used by Artisan.
 *
 * Foundry provides these objects at runtime. Keeping the boundary typed as
 * `any` lets TypeScript validate Artisan's own code without pretending that
 * this project ships the complete Foundry type definitions.
 */
declare const foundry: any;
declare const game: any;
declare const canvas: any;
declare const ui: any;
declare const Hooks: any;
declare const Dialog: any;
declare const Roll: any;
type Roll = any;
declare const ChatMessage: any;

declare const Actor: any;
type Actor = any;

declare const Item: any;
type Item = any;

declare const Folder: any;
type Folder = any;

declare function fromUuid(uuid: string): Promise<any>;
declare function saveDataToFile(
    data: string,
    type: string,
    filename: string
): void;
