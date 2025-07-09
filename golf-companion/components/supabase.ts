import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://emgqdjhbmkjepbjdpnmh.supabase.co", // your project URL here
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtZ3FkamhibWtqZXBiamRwbm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMzIyMDAsImV4cCI6MjA2NzYwODIwMH0.9HuTa44l_E_NTOpgOSIpe8LKnZEi_sjaOSbMVjU3NLc" // your anon key here
);