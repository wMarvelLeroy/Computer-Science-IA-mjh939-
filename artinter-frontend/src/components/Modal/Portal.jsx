import { createPortal } from 'react-dom';

export default function Portal({ children }) {
  const target = document.querySelector('.container') || document.body;
  return createPortal(children, target);
}
