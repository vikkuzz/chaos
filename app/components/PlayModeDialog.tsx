"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import Link from "next/link";

export function PlayModeDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const open = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) {
        dialog.close();
      }
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-lg transition-colors min-h-[48px]"
      >
        Играть
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-0 max-h-none max-w-none w-full h-full bg-transparent p-4 text-slate-100 backdrop:bg-black/60 open:flex open:items-center open:justify-center"
      >
        <div className="w-[min(100%,24rem)] rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl">
          <h2 id={titleId} className="text-xl font-semibold text-white mb-1">
            Выберите режим
          </h2>
          <p className="text-sm text-slate-400 mb-5">
            Локальная игра на этом устройстве или онлайн с другими.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/game"
              onClick={close}
              className="inline-flex items-center justify-center px-4 py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors min-h-[44px]"
            >
              Локальная игра
            </Link>
            <Link
              href="/game?mode=multiplayer"
              onClick={close}
              className="inline-flex items-center justify-center px-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors min-h-[44px]"
            >
              Мультиплеер
              <span className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide">
                Бета
              </span>
            </Link>
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center justify-center px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-colors min-h-[44px]"
            >
              Отмена
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
