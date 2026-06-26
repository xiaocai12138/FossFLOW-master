import { DiagramData } from '../diagramUtils';

/**
 * Metadata wrapper for diagrams stored by the application shell.
 */
export interface SavedDiagram {
  id: string;
  name: string;
  data: DiagramData;
  createdAt: string;
  updatedAt: string;
}
