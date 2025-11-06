// TypeScript types for the Invoice Automator app

export type SubscriptionTier = 'free' | 'monthly_basic' | 'annual_basic';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  business_name?: string;
  business_address?: string;
  business_phone?: string;
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
  paid_at?: string;
  last_reminder_sent_at?: string;
  reminder_count: number;
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
