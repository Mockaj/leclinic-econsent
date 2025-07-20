-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create templates table
CREATE TABLE templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 1,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create completed_consents table
CREATE TABLE completed_consents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_path TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    auth_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex')
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('consent-templates', 'consent-templates', false),
    ('completed-consents', 'completed-consents', false);

-- RLS Policies for templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all templates" ON templates
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can insert templates" ON templates
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Staff can update templates" ON templates
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can delete templates" ON templates
    FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for completed_consents
ALTER TABLE completed_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all completed consents" ON completed_consents
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can insert completed consents" ON completed_consents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Staff can update completed consents" ON completed_consents
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can delete completed consents" ON completed_consents
    FOR DELETE USING (auth.role() = 'authenticated');

-- Storage policies for templates bucket
CREATE POLICY "Staff can upload templates" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'consent-templates' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Staff can view templates" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'consent-templates' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Staff can delete templates" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'consent-templates' AND
        auth.role() = 'authenticated'
    );

-- Storage policies for completed consents bucket
CREATE POLICY "Staff can upload completed consents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'completed-consents' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Staff can view completed consents" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'completed-consents' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Staff can delete completed consents" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'completed-consents' AND
        auth.role() = 'authenticated'
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_templates_updated_at 
    BEFORE UPDATE ON templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
