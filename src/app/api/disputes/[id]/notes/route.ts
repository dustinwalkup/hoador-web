import { NextRequest, NextResponse } from "next/server";
import { withRequestLogging } from "@/lib/api/with-request-logging";
import {
  getAuthenticatedUserResponse,
  handleApiError,
  parseFormData,
} from "@/lib/api/route-helpers";
import { disputeDAL } from "@/dal";
import { z } from "zod";

/**
 * POST /api/disputes/[id]/notes
 * Create an internal note (admin only)
 */
const createNoteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate and check admin
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId: adminId, isAdmin } = authResult;

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      );
    }

    const { id: disputeId } = await params;

    // Verify dispute exists
    const dispute = await disputeDAL.getById(disputeId);
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await parseFormData(request);
    const validationResult = createNoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { content } = validationResult.data;

    // Create note
    const note = await disputeDAL.createInternalNote({
      disputeId,
      adminId,
      content,
    });

    // Create audit log
    await disputeDAL.createAuditLog({
      disputeId,
      actionType: "note_created",
      userId: adminId,
      details: {
        noteId: note.id,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
export const POST = withRequestLogging(
  postHandler,
  "POST /api/disputes/[id]/notes",
);

/**
 * PUT /api/disputes/[id]/notes
 * Update an internal note (admin only)
 */
const updateNoteSchema = z.object({
  noteId: z.string().uuid("Invalid note ID"),
  content: z.string().min(1, "Note content is required"),
});

async function putHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate and check admin
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId: adminId, isAdmin } = authResult;

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      );
    }

    const { id: disputeId } = await params;

    // Verify dispute exists
    const dispute = await disputeDAL.getById(disputeId);
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await parseFormData(request);
    const validationResult = updateNoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { noteId, content } = validationResult.data;

    // Update note
    const updatedNote = await disputeDAL.updateInternalNote(noteId, content);

    // Verify note belongs to this dispute
    if (updatedNote.disputeId !== disputeId) {
      return NextResponse.json(
        { error: "Note does not belong to this dispute" },
        { status: 400 },
      );
    }

    // Create audit log
    await disputeDAL.createAuditLog({
      disputeId,
      actionType: "note_updated",
      userId: adminId,
      details: {
        noteId: updatedNote.id,
      },
    });

    return NextResponse.json(updatedNote);
  } catch (error) {
    return handleApiError(error);
  }
}
export const PUT = withRequestLogging(
  putHandler,
  "PUT /api/disputes/[id]/notes",
);

/**
 * DELETE /api/disputes/[id]/notes
 * Delete an internal note (admin only)
 */
const deleteNoteSchema = z.object({
  noteId: z.string().uuid("Invalid note ID"),
});

async function deleteHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate and check admin
    const authResult = await getAuthenticatedUserResponse();
    if (authResult instanceof NextResponse) {
      return authResult; // Returns 401
    }
    const { userId: adminId, isAdmin } = authResult;

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      );
    }

    const { id: disputeId } = await params;

    // Verify dispute exists
    const dispute = await disputeDAL.getById(disputeId);
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await parseFormData(request);
    const validationResult = deleteNoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { noteId } = validationResult.data;

    // Verify note belongs to this dispute before deleting
    const notes = await disputeDAL.getInternalNotesByDisputeId(disputeId);
    const note = notes.find((n) => n.id === noteId);

    if (!note) {
      return NextResponse.json(
        { error: "Note not found or does not belong to this dispute" },
        { status: 404 },
      );
    }

    // Delete note
    await disputeDAL.deleteInternalNote(noteId);

    // Create audit log
    await disputeDAL.createAuditLog({
      disputeId,
      actionType: "note_deleted",
      userId: adminId,
      details: {
        noteId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
export const DELETE = withRequestLogging(
  deleteHandler,
  "DELETE /api/disputes/[id]/notes",
);
