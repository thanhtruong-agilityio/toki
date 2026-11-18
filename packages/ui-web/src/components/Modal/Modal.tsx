import { forwardRef } from "react";
import { Dialog, type ModalProps } from "./Dialog";
import "./Modal.css";

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  function Modal(props, ref) {
    return <Dialog {...props} ref={ref} />;
  },
);
