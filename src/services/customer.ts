import { supabase } from './supabase';
import { Customer } from '../types';

export const customerService = {
  async getCustomers(): Promise<Customer[]> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', session.data.session.user.id)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createCustomer(customer: Omit<Customer, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Customer> {
    if (!customer.name?.trim()) throw new Error('Customer name is required');

    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('customers')
      .insert({
        ...customer,
        user_id: session.data.session.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCustomer(id: string) {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
  },
};
