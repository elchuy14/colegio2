// Configuración de Supabase
const SUPABASE_URL = 'https://doefhepxbdshzcxecnbp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvZWZoZXB4YmRzaHpjeGVjbmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzY0MDEsImV4cCI6MjEwNjQ1MjQwMX0.LD0BCYfYoE0pZIzVta_aZjso6-A1doGmUbKAfV0GyGE';

let sb = null;
let persons = [];
let editingId = null;

const form = document.getElementById('personForm');
const tableBody = document.getElementById('tableBody');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const personIdInput = document.getElementById('personId');
const viewModal = document.getElementById('viewModal');
const viewContent = document.getElementById('viewContent');
const closeModal = document.querySelector('.close');

document.addEventListener('DOMContentLoaded', async () => {
    initSupabase();
    await loadPersons();
    renderTable();
});

function initSupabase() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase no está cargado. Verifica la conexión a internet.');
        showNotification('Error: Supabase no cargado. Usando modo local.', 'error');
        return;
    }
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('TU_SUPABASE_URL')) {
        console.warn('Credenciales de Supabase no configuradas. Usando localStorage como fallback.');
        showNotification('Configura tus credenciales de Supabase en app.js', 'error');
        return;
    }
    
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase conectado correctamente');
}

async function loadPersons() {
    if (!sb) {
        loadFromLocalStorage();
        return;
    }
    
    try {
        const { data, error } = await sb
            .from('personas')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        persons = data || [];
        renderTable();
    } catch (error) {
        console.error('Error cargando personas:', error);
        showNotification('Error al cargar datos: ' + error.message, 'error');
        loadFromLocalStorage();
    }
}

function loadFromLocalStorage() {
    const stored = localStorage.getItem('persons');
    if (stored) {
        persons = JSON.parse(stored);
    }
}

async function addPerson(person) {
    if (!sb) {
        addPersonLocal(person);
        return;
    }
    
    try {
        const { data, error } = await sb
            .from('personas')
            .insert([person])
            .select()
            .single();
        
        if (error) throw error;
        
        persons.unshift(data);
        renderTable();
        showNotification('Persona agregada correctamente', 'success');
    } catch (error) {
        console.error('Error agregando persona:', error);
        if (error.code === '23505') {
            showNotification('La cédula ya existe', 'error');
        } else {
            showNotification('Error al agregar: ' + error.message, 'error');
        }
        addPersonLocal(person);
    }
}

function addPersonLocal(person) {
    const newPerson = {
        id: generateId(),
        ...person,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    persons.unshift(newPerson);
    saveToLocalStorage();
    renderTable();
    showNotification('Persona agregada (modo local)', 'success');
}

async function updatePerson(id, updatedData) {
    if (!sb) {
        updatePersonLocal(id, updatedData);
        return;
    }
    
    try {
        const { data, error } = await sb
            .from('personas')
            .update(updatedData)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        const index = persons.findIndex(p => p.id === id);
        if (index !== -1) {
            persons[index] = data;
        }
        renderTable();
        showNotification('Persona actualizada correctamente', 'success');
    } catch (error) {
        console.error('Error actualizando persona:', error);
        if (error.code === '23505') {
            showNotification('La cédula ya existe', 'error');
        } else {
            showNotification('Error al actualizar: ' + error.message, 'error');
        }
        updatePersonLocal(id, updatedData);
    }
}

function updatePersonLocal(id, updatedData) {
    const index = persons.findIndex(p => p.id === id);
    if (index !== -1) {
        persons[index] = { 
            ...persons[index], 
            ...updatedData,
            updated_at: new Date().toISOString()
        };
        saveToLocalStorage();
        renderTable();
        showNotification('Persona actualizada (modo local)', 'success');
    }
}

async function deletePerson(id) {
    if (!confirm('¿Está seguro de eliminar esta persona?')) return;
    
    if (!sb) {
        deletePersonLocal(id);
        return;
    }
    
    try {
        const { error } = await supabase
            .from('personas')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        persons = persons.filter(p => p.id !== id);
        renderTable();
        showNotification('Persona eliminada correctamente', 'success');
    } catch (error) {
        console.error('Error eliminando persona:', error);
        showNotification('Error al eliminar: ' + error.message, 'error');
        deletePersonLocal(id);
    }
}

function deletePersonLocal(id) {
    persons = persons.filter(p => p.id !== id);
    saveToLocalStorage();
    renderTable();
    showNotification('Persona eliminada (modo local)', 'success');
}

function viewPerson(id) {
    const person = persons.find(p => p.id === id);
    if (person) {
        viewContent.innerHTML = `
            <p><strong>Nombre:</strong> ${escapeHtml(person.nombre)}</p>
            <p><strong>Apellido:</strong> ${escapeHtml(person.apellido)}</p>
            <p><strong>Edad:</strong> ${person.edad}</p>
            <p><strong>Cédula:</strong> ${escapeHtml(person.cedula)}</p>
            ${person.created_at ? `<p><strong>Creado:</strong> ${new Date(person.created_at).toLocaleString()}</p>` : ''}
            ${person.updated_at ? `<p><strong>Actualizado:</strong> ${new Date(person.updated_at).toLocaleString()}</p>` : ''}
        `;
        viewModal.classList.add('active');
    }
}

function editPerson(id) {
    const person = persons.find(p => p.id === id);
    if (person) {
        document.getElementById('nombre').value = person.nombre;
        document.getElementById('apellido').value = person.apellido;
        document.getElementById('edad').value = person.edad;
        document.getElementById('cedula').value = person.cedula;
        personIdInput.value = person.id;
        editingId = person.id;
        
        submitBtn.textContent = 'Actualizar';
        cancelBtn.style.display = 'inline-block';
        
        document.getElementById('nombre').focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function resetForm() {
    form.reset();
    personIdInput.value = '';
    editingId = null;
    submitBtn.textContent = 'Guardar';
    cancelBtn.style.display = 'none';
}

function renderTable() {
    tableBody.innerHTML = '';
    
    if (persons.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #95a5a6;">
                    No hay personas registradas
                </td>
            </tr>
        `;
        return;
    }
    
    persons.forEach(person => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(person.nombre)}</td>
            <td>${escapeHtml(person.apellido)}</td>
            <td>${person.edad}</td>
            <td>${escapeHtml(person.cedula)}</td>
            <td>
                <div class="actions">
                    <button class="btn-icon btn-view" onclick="viewPerson('${person.id}')" title="Ver">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon btn-edit" onclick="editPerson('${person.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deletePerson('${person.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function saveToLocalStorage() {
    localStorage.setItem('persons', JSON.stringify(persons));
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    const bgColor = type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        z-index: 2000;
        animation: slideIn 0.3s ease;
        background: ${bgColor};
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const person = {
        nombre: document.getElementById('nombre').value.trim(),
        apellido: document.getElementById('apellido').value.trim(),
        edad: parseInt(document.getElementById('edad').value),
        cedula: document.getElementById('cedula').value.trim()
    };

    if (editingId !== null) {
        updatePerson(editingId, person);
    } else {
        addPerson(person);
    }
    
    resetForm();
});

cancelBtn.addEventListener('click', resetForm);

closeModal.addEventListener('click', () => {
    viewModal.classList.remove('active');
});

    }
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' && document.activeElement.id !== 'calcDisplay') {
        return;
    }
    
    const key = e.key;
    
    if ((key >= '0' && key <= '9') || key === '.') {
        appendToDisplay(key);
    } else if (key === '+' || key === '-' || key === '*' || key === '/') {
        appendToDisplay(key);
        e.preventDefault();
    } else if (key === 'Enter' || key === '=') {
        calculate();
        e.preventDefault();
    } else if (key === 'Escape' || key === 'c' || key === 'C') {
        clearDisplay();
        e.preventDefault();
    } else if (key === 'Backspace') {
        backspace();
        e.preventDefault();
    }
});

function appendToDisplay(value) {
    const display = document.getElementById('calcDisplay');
    if (display.value === 'Error') {
        display.value = '';
    }
    display.value += value;
}

function clearDisplay() {
    document.getElementById('calcDisplay').value = '';
}

function backspace() {
    const display = document.getElementById('calcDisplay');
    if (display.value === 'Error') {
        display.value = '';
        return;
    }
    display.value = display.value.slice(0, -1);
}

function calculate() {
    const display = document.getElementById('calcDisplay');
    try {
        if (display.value === '') return;
        const result = eval(display.value.replace(/×/g, '*'));
        display.value = result === Infinity || isNaN(result) ? 'Error' : result;
    } catch (error) {
        display.value = 'Error';
    }
}

function initCalculator() {
    const calcBtns = document.querySelectorAll('.calc-btn');
    const display = document.getElementById('calcDisplay');
    
    calcBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.value;
            
            if (value === 'C') {
                clearDisplay();
            } else if (value === '←') {
                backspace();
            } else if (value === '=') {
                calculate();
            } else {
                appendToDisplay(value);
            }
        });
    });
    
    display.value = '';
}

initCalculator();