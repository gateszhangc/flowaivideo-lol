import { ArrowLeft, ArrowRight, Check, Coins, CreditCard, DollarSign, HelpCircle, Menu, Settings, Shield, User, Zap, LogOut, ExternalLink, Plus, Trash, Pencil, Download, Eye, Search } from 'lucide-react';
const icons: Record<string, any> = { ArrowLeft, ArrowRight, Check, Coins, CreditCard, DollarSign, HelpCircle, Menu, Settings, Shield, User, Zap, LogOut, ExternalLink, Plus, Trash, Pencil, Download, Eye, Search, RiFlashlightFill: Zap };

export function SmartIcon({ name, size = 24, className, ...props }: { name: string; size?: number; className?: string; [key: string]: any }) {
  const Icon = icons[name] || HelpCircle;
  return <Icon size={size} className={className} {...props} />;
}
