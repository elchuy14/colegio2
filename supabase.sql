-- SQL para Supabase - Tabla de Personas (versión actualizable)

-- Habilitar UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tabla de personas (solo si no existe)
CREATE TABLE IF NOT EXISTS personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    edad INTEGER NOT NULL CHECK (edad > 0 AND edad <= 120),
    cedula VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices (usar IF NOT EXISTS requiere PostgreSQL 15+, alternativa: DO block)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_personas_cedula') THEN
        CREATE INDEX idx_personas_cedula ON personas(cedula);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_personas_nombre_apellido') THEN
        CREATE INDEX idx_personas_nombre_apellido ON personas(nombre, apellido);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_personas_created_at') THEN
        CREATE INDEX idx_personas_created_at ON personas(created_at DESC);
    END IF;
END $$;

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Eliminar trigger anterior si existe y crear nuevo
DROP TRIGGER IF EXISTS update_personas_updated_at ON personas;
CREATE TRIGGER update_personas_updated_at
    BEFORE UPDATE ON personas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Políticas de Row Level Security (RLS)
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes y recrearlas
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON personas;
CREATE POLICY "Permitir lectura a usuarios autenticados" ON personas
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados" ON personas;
CREATE POLICY "Permitir inserción a usuarios autenticados" ON personas
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir actualización a usuarios autenticados" ON personas;
CREATE POLICY "Permitir actualización a usuarios autenticados" ON personas
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir eliminación a usuarios autenticados" ON personas;
CREATE POLICY "Permitir eliminación a usuarios autenticados" ON personas
    FOR DELETE USING (auth.role() = 'authenticated');

-- Función RPC para buscar personas (CREATE OR REPLACE maneja existencia)
CREATE OR REPLACE FUNCTION buscar_personas(
    search_term TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    edad INTEGER,
    cedula VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.nombre,
        p.apellido,
        p.edad,
        p.cedula,
        p.created_at
    FROM personas p
    WHERE 
        search_term IS NULL 
        OR p.nombre ILIKE '%' || search_term || '%'
        OR p.apellido ILIKE '%' || search_term || '%'
        OR p.cedula ILIKE '%' || search_term || '%'
    ORDER BY p.created_at DESC
    LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejemplos de consultas útiles:
-- INSERT INTO personas (nombre, apellido, edad, cedula) VALUES ('Juan', 'Pérez', 30, '12345678');
-- SELECT * FROM personas ORDER BY created_at DESC;
-- SELECT * FROM personas WHERE cedula = '12345678';
-- UPDATE personas SET nombre = 'Juan Carlos', edad = 31 WHERE cedula = '12345678';
-- DELETE FROM personas WHERE cedula = '12345678';
-- SELECT COUNT(*) FROM personas;
-- SELECT EXISTS(SELECT 1 FROM personas WHERE cedula = '12345678');