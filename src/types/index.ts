// TypeScript types for the Invoice Automator app

export type SubscriptionTier = 'free' | 'monthly_basic' | 'annual_basic';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'void';
export type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';
export type InvoiceTemplate = 'classic' | 'painter' | 'minimal';
export type TemplateHeaderLayout = 'stacked' | 'inline';
export type PaymentMethodType =
  | 'paypal'
  | 'venmo'
  | 'cash_app'
  | 'zelle'
  | 'stripe'
  | 'bank_transfer'
  | 'other';

export interface BusinessPaymentMethod {
  type: PaymentMethodType;
  label: string;
  value: string;
}

export interface InvoiceTemplateSettings {
  accent_color: string;
  header_layout: TemplateHeaderLayout;
  show_logo: boolean;
  show_business_contact: boolean;
  show_notes: boolean;
  highlight_totals: boolean;
  footer_text: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  business_name?: string;
  business_address?: string;
  business_phone?: string;
  payment_instructions?: string;
  payment_methods?: BusinessPaymentMethod[] | null;
  logo_url?: string;
  invoice_template?: InvoiceTemplate;
  template_settings?: Partial<InvoiceTemplateSettings> | null;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  subscription_ends_at?: string;
  platform_fee_enabled: boolean;
  platform_fee_percentage: number;
  invoice_count_current_month: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  customer_id?: string;
  customer_name?: string; // Denormalized - preserved even if customer deleted
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  stripe_payment_link?: string;
  stripe_payment_intent_id?: string;
  sent_at?: string;
  paid_at?: string;
  last_reminder_sent_at?: string;
  reminder_count: number;
  voided_at?: string;
  void_reason?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  items?: InvoiceItem[];
}

export interface PaymentRecord {
  id: string;
  invoice_id: string;
  stripe_payment_intent_id?: string;
  stripe_charge_id?: string;
  amount: number;
  currency: string;
  platform_fee_amount: number;
  status: PaymentStatus;
  paid_at: string;
  receipt_url?: string;
  created_at: string;
}

export interface InvoiceFormData {
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  issue_date: Date;
  due_date: Date;
  tax_rate: number;
  notes?: string;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
  }[];
}
