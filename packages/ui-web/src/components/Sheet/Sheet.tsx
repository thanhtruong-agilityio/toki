import { forwardRef } from "react";
import { Dialog, type ModalProps } from "../Modal/Dialog";
import "../Modal/Modal.css";
import "./Sheet.css";

// The props of Modal (R6).
export type SheetProps = ModalProps;

export const Sheet = forwardRef<HTMLDivElement, SheetProps>(
  function Sheet(props, ref) {
    return <Dialog {...props} ref={ref} sheet />;
  },
);
