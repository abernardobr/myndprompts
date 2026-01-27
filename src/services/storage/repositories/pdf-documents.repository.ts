import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../db';
import { BaseRepository } from './base.repository';
import type { IPDFDocument } from '../entities';

/**
 * Repository for managing PDF documents attached to chat sessions.
 *
 * Tracks PDF files referenced during a conversation for the
 * side-by-side PDF canvas feature.
 */
export class PDFDocumentsRepository extends BaseRepository<IPDFDocument, string> {
  private static instance: PDFDocumentsRepository | null = null;

  private constructor() {
    super(getDB().pdfDocuments);
  }

  static getInstance(): PDFDocumentsRepository {
    if (!PDFDocumentsRepository.instance) {
      PDFDocumentsRepository.instance = new PDFDocumentsRepository();
    }
    return PDFDocumentsRepository.instance;
  }

  /**
   * Add a PDF document to a session
   */
  async addDocument(
    sessionId: string,
    filePath: string,
    fileName: string,
    pageCount: number
  ): Promise<IPDFDocument> {
    const doc: IPDFDocument = {
      id: uuidv4(),
      sessionId,
      filePath,
      fileName,
      pageCount,
      addedAt: new Date(),
    };

    await this.create(doc);
    return doc;
  }

  /**
   * Get all PDF documents for a session
   */
  async getBySession(sessionId: string): Promise<IPDFDocument[]> {
    return this.table.where('sessionId').equals(sessionId).toArray();
  }

  /**
   * Remove a document and its associated annotations
   */
  async removeDocument(id: string): Promise<void> {
    const db = getDB();
    await db.transaction('rw', [db.pdfDocuments, db.pdfAnnotations], async () => {
      // Delete annotations for this document
      const annotations = await db.pdfAnnotations.where('documentId').equals(id).toArray();
      const annotationIds = annotations.map((a) => a.id);
      if (annotationIds.length > 0) {
        await db.pdfAnnotations.bulkDelete(annotationIds);
      }
      // Delete the document
      await this.delete(id);
    });
  }

  /**
   * Delete all documents for a session
   */
  async deleteSessionDocuments(sessionId: string): Promise<void> {
    const docs = await this.getBySession(sessionId);
    const ids = docs.map((d) => d.id);
    if (ids.length > 0) {
      await this.deleteMany(ids);
    }
  }

  static resetInstance(): void {
    PDFDocumentsRepository.instance = null;
  }
}

/**
 * Get the PDFDocumentsRepository singleton
 */
export function getPDFDocumentsRepository(): PDFDocumentsRepository {
  return PDFDocumentsRepository.getInstance();
}
