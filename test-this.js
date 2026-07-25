class Foo {
  mapClienteFromDB(c) {
    return {
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono ?? null,
      tipo: c.tipo ?? 'mayorista',
      direccion: c.direccion ?? null,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }
  
  test() {
    const data = [{ id: 1, nombre: 'a' }];
    return data.map(this.mapClienteFromDB);
  }
}

try {
  const f = new Foo();
  console.log(f.test());
} catch(e) {
  console.error("ERROR:", e.message);
}
