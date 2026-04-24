import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "./useAuth";
import { signInWithGoogle, signOutUser } from "@/lib/firebase";

export function AuthMenu() {
  const { user, loading, isConfigured } = useAuth();

  if (!isConfigured || loading) return null;

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await signInWithGoogle();
          } catch (err) {
            toast.error("Sign-in failed", {
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }}
        className="gap-2"
      >
        <LogIn className="h-4 w-4" />
        Sign in
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="h-6 w-6 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-medium">
              {(user.displayName ?? user.email ?? "?")[0]?.toUpperCase()}
            </div>
          )}
          <span className="hidden max-w-[10rem] truncate sm:inline">
            {user.displayName ?? user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => signOutUser()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
