"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDispute } from "../hooks";
import {
  useCreateInternalNote,
  useUpdateInternalNote,
  useDeleteInternalNote,
} from "../hooks/use-internal-notes";
import { formatDistanceToNow } from "@/lib/utils/date.utils";

const noteSchema = z.object({
  content: z
    .string()
    .min(1, "Note content is required")
    .max(5000, "Note must be 5000 characters or less"),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface InternalNotesSectionProps {
  disputeId: string;
}

/**
 * Admin-only component for managing internal notes on a dispute
 * Allows admins to create, edit, and delete internal notes
 */
export function InternalNotesSection({ disputeId }: InternalNotesSectionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const { data: dispute } = useDispute(disputeId);
  const createNote = useCreateInternalNote(disputeId);
  const updateNote = useUpdateInternalNote(disputeId);
  const deleteNote = useDeleteInternalNote(disputeId);

  const createForm = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      content: "",
    },
  });

  const editForm = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
  });

  const handleCreateNote = async (data: NoteFormData) => {
    await createNote.mutateAsync(data.content);
    createForm.reset();
    setIsCreating(false);
  };

  const handleStartEdit = (noteId: string, currentContent: string) => {
    editForm.reset({ content: currentContent });
    setEditingNoteId(noteId);
  };

  const handleUpdateNote = async (data: NoteFormData) => {
    if (!editingNoteId) return;
    await updateNote.mutateAsync({
      noteId: editingNoteId,
      content: data.content,
    });
    setEditingNoteId(null);
    editForm.reset();
  };

  const handleDeleteNote = async () => {
    if (!deletingNoteId) return;
    await deleteNote.mutateAsync(deletingNoteId);
    setDeletingNoteId(null);
  };

  const notes = dispute?.internalNotes || [];
  const sortedNotes = [...notes].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Internal Notes ({notes.length})
            </CardTitle>
            <CardDescription>
              Private notes visible only to admins
            </CardDescription>
          </div>
          {!isCreating && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create Note Form */}
        {isCreating && (
          <Card>
            <CardContent className="pt-6">
              <Form {...createForm}>
                <form
                  onSubmit={createForm.handleSubmit(handleCreateNote)}
                  className="space-y-4"
                >
                  <FormField
                    control={createForm.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Note</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add an internal note..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          This note will only be visible to admins
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreating(false);
                        createForm.reset();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createNote.isPending}>
                      {createNote.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Create Note
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Notes List */}
        {sortedNotes.length === 0 && !isCreating ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            No internal notes yet. Click &quot;Add Note&quot; to create one.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedNotes.map((note) => {
              const isEditing = editingNoteId === note.id;

              if (isEditing) {
                return (
                  <Card key={note.id}>
                    <CardContent className="pt-6">
                      <Form {...editForm}>
                        <form
                          onSubmit={editForm.handleSubmit(handleUpdateNote)}
                          className="space-y-4"
                        >
                          <FormField
                            control={editForm.control}
                            name="content"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea
                                    className="min-h-[100px]"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setEditingNoteId(null);
                                editForm.reset();
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={updateNote.isPending}
                            >
                              {updateNote.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <Check className="mr-2 h-4 w-4" />
                                  Save
                                </>
                              )}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Card key={note.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="text-muted-foreground text-xs">
                          <span>
                            Created{" "}
                            {formatDistanceToNow(note.createdAt, {
                              addSuffix: true,
                            })}
                          </span>
                          {note.updatedAt.getTime() !==
                            note.createdAt.getTime() && (
                            <span className="ml-2">
                              • Updated{" "}
                              {formatDistanceToNow(note.updatedAt, {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleStartEdit(note.id, note.content)
                            }
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingNoteId(note.id)}
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deletingNoteId !== null}
          onOpenChange={(open) => !open && setDeletingNoteId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Note</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this note? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteNote}
                disabled={deleteNote.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteNote.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
