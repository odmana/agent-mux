import { forwardRef, type HTMLAttributes } from 'react';

type ScrollAreaProps = HTMLAttributes<HTMLDivElement>;

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { className = '', children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={`scrollbar-subtle overflow-y-auto ${className}`} {...rest}>
      {children}
    </div>
  );
});

export default ScrollArea;
