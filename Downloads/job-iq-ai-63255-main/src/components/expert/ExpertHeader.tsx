import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, LogOut, User, Home, DollarSign, Trash2, Briefcase, CheckCircle, AlertCircle, MessageSquare } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useLanguage } from "@/contexts/LanguageContext";

export const ExpertHeader = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { t } = useLanguage();
  
  const { 
    notifications, 
    unreadCount, 
    loading,
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    handleNotificationClick 
  } = useNotifications();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const { data: profileData } = await supabase
        .from("expert_profiles")
        .select("id, full_name, avatar_url, email")
        .eq("user_id", session.user.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "job": return <Briefcase className="w-4 h-4 text-primary" />;
      case "success": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error": return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "interview": return <MessageSquare className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins}m`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return `Il y a ${diffDays}j`;
  };

  const onNotificationClick = (notif: Notification) => {
    setNotificationsOpen(false);
    handleNotificationClick(notif);
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-background border-b border-border z-50">
      <div className="flex items-center justify-between h-14 px-4 max-w-4xl mx-auto">
        <Link to="/expert/home" className="text-2xl font-bold text-primary">
          STEF
        </Link>
        
        <div className="flex items-center gap-1">
          {/* Theme Toggle */}
          <ThemeToggle />
          
          {/* Language Switcher */}
          <LanguageSwitcher />
          
          {/* Notifications */}
          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-semibold">{t('notifications.title')}</h3>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
                    {t('notifications.markAllRead')}
                  </Button>
                )}
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="p-6 text-center">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('notifications.noNotifications')}</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors group ${
                        !notif.is_read ? "bg-primary/5" : ""
                      }`}
                      onClick={() => onNotificationClick(notif)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${!notif.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                              {notif.title}
                            </p>
                            <div className="flex items-center gap-1">
                              {!notif.is_read && (
                                <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notif.id);
                                }}
                              >
                                <Trash2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(notif.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className="p-2 border-t">
                  <Button 
                    variant="ghost" 
                    className="w-full text-sm h-8"
                    onClick={() => {
                      setNotificationsOpen(false);
                      navigate("/expert/home");
                    }}
                  >
                    {t('header.viewActivity')}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          
          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="bg-muted text-sm">
                    {profile?.full_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{profile?.full_name || "User"}</span>
                  <span className="text-xs text-muted-foreground font-normal truncate">
                    {profile?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => navigate("/expert/profile")}>
                <User className="w-4 h-4 mr-2" />
                {t('profile.title')}
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => navigate("/expert/home")}>
                <Home className="w-4 h-4 mr-2" />
                {t('dashboard')}
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => navigate("/expert/earnings")}>
                <DollarSign className="w-4 h-4 mr-2" />
                {t('earnings.title')}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                {t('profile.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
