import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { cn } from "@/shared/lib/cn.ts";

export function ContextMenu(props: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root {...props} />;
}

export const ContextMenuTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Trigger>
>((props, ref) => <ContextMenuPrimitive.Trigger ref={ref} {...props} />);
ContextMenuTrigger.displayName = "ContextMenuTrigger";

export const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      collisionPadding={12}
      className={cn("dropdown-menu-content", className)}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = "ContextMenuContent";

type ContextMenuItemProps = React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
  destructive?: boolean;
};

export const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  ContextMenuItemProps
>(({ className, destructive, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn("dropdown-menu-item", destructive && "dropdown-menu-item--destructive", className)}
    {...props}
  />
));
ContextMenuItem.displayName = "ContextMenuItem";

export const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("dropdown-menu-separator", className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = "ContextMenuSeparator";
