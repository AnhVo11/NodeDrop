import { useRef, useCallback } from 'react';

export function useEditHistory(onUpdateNotes, stateRef) {
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const pushUndo = useCallback((prev) => {
    undoStack.current.push(prev.map(n => ({ ...n })));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(stateRef.current.noteObjs.map(n => ({ ...n })));
    onUpdateNotes(undoStack.current.pop());
  }, [onUpdateNotes, stateRef]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(stateRef.current.noteObjs.map(n => ({ ...n })));
    onUpdateNotes(redoStack.current.pop());
  }, [onUpdateNotes, stateRef]);

  return { pushUndo, undo, redo };
}