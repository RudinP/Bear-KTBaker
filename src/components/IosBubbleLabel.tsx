export function IosBubbleLabel({ children, className }: {
  children: React.ReactNode;
  className: string;
}) {
  return <span
    className={className}
    data-content-mode="single-line"
    data-ios-label-placement="title-edge-insets"
  >{children}</span>;
}
