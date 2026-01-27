import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IPDFAnnotation } from '../entities';

/**
 * Repository for managing PDF annotations within documents.
 *
 * Supports highlights, notes, and bookmarks on specific PDF pages.
 */
export class PDFAnnotationsRepository extends BaseRepository<IPDFAnnotation, string> {
  private static instance: PDFAnnotationsRepository | null = null;

  private constructor() {
    super(getDB().pdfAnnotations);
  }

  static getInstance(): PDFAnnotationsRepository {
    if (!PDFAnnotationsRepository.instance) {
      PDFAnnotationsRepository.instance = new PDFAnnotationsRepository();
    }
    return PDFAnnotationsRepository.instance;
  }

  /**
   * Add an annotation to a PDF document
   */
  async addAnnotation(
    documentId: string,
    sessionId: string,
    pageNumber: number,
    type: 'highlight' | 'note' | 'bookmark',
    options?: {
      content?: string;
      position: { x: number; y: number; width: number; height: number };
      color?: string;
    }
  ): Promise<IPDFAnnotation> {
    const annotation: IPDFAnnotation = {
      id: uuidv4(),
      documentId,
      sessionId,
      pageNumber,
      type,
      content: options?.content,
      position: options?.position ?? { x: 0, y: 0, width: 0, height: 0 },
      color: options?.color,
      createdAt: new Date(),
    };

    await this.create(annotation);
    return annotation;
  }

  /**
   * Get all annotations for a document
   */
  async getByDocument(documentId: string): Promise<IPDFAnnotation[]> {
    return this.table.where('documentId').equals(documentId).toArray();
  }

  /**
   * Get annotations for a specific page of a document
   */
  async getByPage(documentId: string, pageNumber: number): Promise<IPDFAnnotation[]> {
    const docAnnotations = await this.getByDocument(documentId);
    return docAnnotations.filter((a) => a.pageNumber === pageNumber);
  }

  /**
   * Delete all annotations for a document
   */
  async deleteDocumentAnnotations(documentId: string): Promise<void> {
    const annotations = await this.getByDocument(documentId);
    const ids = annotations.map((a) => a.id);
    if (ids.length > 0) {
      await this.deleteMany(ids);
    }
  }

  /**
   * Delete all annotations for a session
   */
  async deleteSessionAnnotations(sessionId: string): Promise<void> {
    const annotations = await this.table.where('sessionId').equals(sessionId).toArray();
    const ids = annotations.map((a) => a.id);
    if (ids.length > 0) {
      await this.deleteMany(ids);
    }
  }

  static resetInstance(): void {
    PDFAnnotationsRepository.instance = null;
  }
}

/**
 * Get the PDFAnnotationsRepository singleton
 */
export function getPDFAnnotationsRepository(): PDFAnnotationsRepository {
  return PDFAnnotationsRepository.getInstance();
}
