/**
 * @file agGridSetup.ts
 * @description One-time AG Grid community module registration and global styles (import once at app entry).
 * @module List-O-Matic-2000/client
 */
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

ModuleRegistry.registerModules([AllCommunityModule])
