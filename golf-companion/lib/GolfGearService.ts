import { supabase } from '@/components/supabase';

export type GolfGearItem = {
  id: string;
  user_id: string;
  type: 'driver' | 'irons' | 'wedges' | 'putter' | 'ball' | 'bag' | 'other';
  brand: string;
  model: string;
  notes?: string | null;
  created_at?: string;
};

export const GolfGearService = {
  async fetchByUser(userId: string): Promise<GolfGearItem[]> {
    const { data, error } = await supabase
      .from('golf_gear')
      .select('id, user_id, type, brand, model, notes, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async add(userId: string, item: Omit<GolfGearItem, 'id' | 'user_id' | 'created_at'>): Promise<GolfGearItem | null> {
    const payload = { ...item, user_id: userId };
    const { data, error } = await supabase
      .from('golf_gear')
      .insert(payload)
      .select('id, user_id, type, brand, model, notes, created_at')
      .single();
    if (error) throw error;
    return data ?? null;
  },

  async remove(userId: string, gearId: string): Promise<void> {
    const { error } = await supabase
      .from('golf_gear')
      .delete()
      .eq('id', gearId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async update(userId: string, gearId: string, partial: Partial<Omit<GolfGearItem, 'id' | 'user_id'>>): Promise<GolfGearItem | null> {
    const { data, error } = await supabase
      .from('golf_gear')
      .update(partial)
      .eq('id', gearId)
      .eq('user_id', userId)
      .select('id, user_id, type, brand, model, notes, created_at')
      .single();
    if (error) throw error;
    return data ?? null;
  },
};
