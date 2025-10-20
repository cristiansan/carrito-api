const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = {
  "type": "service_account",
  "project_id": "carrito-138c3",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@carrito-138c3.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40carrito-138c3.iam.gserviceaccount.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Client data extracted from Excel
const clientes = [
  {codigo: '0001', nombre: 'DAFEROL SA', nombreComercial: 'DAFEROL SA', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'AV. BRIG. GRAL J.A. LAVALLEJA 2022', ciudad: '', provincia: 'MV', pais: 'uy', telefono: '598--29291441', email: 'importaciones@dimm.com.uy'},
  {codigo: '0002', nombre: 'NAPAN LLC', nombreComercial: 'NAPAN LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '8320 NW 14 STREET', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: 'fgallo@napanllc.com'},
  {codigo: '0003', nombre: 'PLANET 613 LLC', nombreComercial: 'PLANET 613 LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '2151 NE 155TH ST UNIT 2', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0004', nombre: 'LAS INTERNATIONAL CORP.', nombreComercial: 'LAS INTERNATIONAL CORP.', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '8320 NW 14 STREET', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0005', nombre: 'TRADE 26 LLC', nombreComercial: 'TRADE 26 LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '2151 NE 155TH ST UNIT 2', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0006', nombre: 'PHOTO IMAGEN & VIDEO EXPORT LLC', nombreComercial: 'PHOTO IMAGEN & VIDEO EXPORT LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '11129 HELENA DR', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0007', nombre: 'SAMSAPPLE STORE LLC', nombreComercial: 'SAMSAPPLE STORE LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '8000 NW 31 ST STE 109', ciudad: '', provincia: 'FL', pais: 'us', telefono: '593--984666777', email: ''},
  {codigo: '0008', nombre: 'POWER CASE USA CORP', nombreComercial: 'POWER CASE USA CORP', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '1520 NW 89TH CT', ciudad: '', provincia: 'FL', pais: 'us', telefono: '30--52004275', email: ''},
  {codigo: '0009', nombre: 'LABTECH S.A', nombreComercial: 'LABTECH S.A', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'CARLOS BACIGALUPI 2084', ciudad: '', provincia: 'MV', pais: 'uy', telefono: '598--29290990', email: ''},
  {codigo: '0010', nombre: 'PETER BOYLSTON CAPITAL LLC', nombreComercial: 'PETER BOYLSTON CAPITAL LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '8333 NW 53RD STREET SUITE 450', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0011', nombre: 'CAMLEM TRADE LLC', nombreComercial: 'CAMLEM TRADE LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '10913 NW 30TH ST SUITE 103', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0012', nombre: 'ALMAR 1618, LLC', nombreComercial: 'ALMAR 1618, LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '2020 NE 163 ST 300D', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0014', nombre: 'BY BUY SRL', nombreComercial: 'BY BUY SRL', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'SUIPACHA 190 PISO 3 DPTO 306', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '3884041867', email: 'ventas@bybuy.com.ar'},
  {codigo: '0015', nombre: 'POWERCASE ARGENTINA SA', nombreComercial: 'POWERCASE ARGENTINA SA', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'CIUDAD DE LA PAZ 1965 15 "B"', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '3884041867', email: ''},
  {codigo: '0016', nombre: 'JB BUSINESS S.A.', nombreComercial: 'JB BUSINESS S.A.', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'CALLE RIO DE JANEIRO', ciudad: '', provincia: 'CDE', pais: 'py', telefono: '3884041867', email: ''},
  {codigo: '0018', nombre: 'RCS INTERNATIONAL INVESTMENT', nombreComercial: 'RCS INTERNATIONAL INVESTMENT', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '3401 SW 160 AVE SUITE 330', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0020', nombre: 'RASH PERU SAC', nombreComercial: 'RASH PERU SAC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'AV SALAVERRY 3310', ciudad: '', provincia: 'LI', pais: 'pe', telefono: '3884041867', email: 'mrodriguez@rashperu.com'},
  {codigo: '0021', nombre: 'TECNOGALAXY CIA LTDA', nombreComercial: 'TECNOGALAXY CIA LTDA', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'AV AJAVI OE5 - 515 Y CALLE N', ciudad: '', provincia: 'QU', pais: 'ec', telefono: '593--987410017', email: ''},
  {codigo: '0022', nombre: 'ARIEL GUIDO THANNER', nombreComercial: 'ARIEL GUIDO THANNER', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'JUAN TTE GRAL PERON 935 2� 208', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '1--153697601', email: 'okoko.ventas@gmail.com'},
  {codigo: '0025', nombre: 'FOX MEDIA ARQ CORP', nombreComercial: 'FOX MEDIA ARQ CORP', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '11251 NW 1 TERRACE', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0027', nombre: 'GRUPO BAZA SRL', nombreComercial: 'GRUPO BAZA SRL', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'CIUDAD DE LA PAZ 1965', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '3884041867', email: ''},
  {codigo: '0028', nombre: 'P & L BUSINESS SOLUTIONS, INC', nombreComercial: 'P & L BUSINESS SOLUTIONS, INC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '2335 NW 107TH AVE', ciudad: '', provincia: 'FL', pais: 'us', telefono: '1--3055928011', email: ''},
  {codigo: '0029', nombre: 'EDUARDO ANDRES BARRO', nombreComercial: 'EDUARDO ANDRES BARRO', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'ALBARELLOS 4392', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '54--91121626499', email: ''},
  {codigo: '0031', nombre: 'NEXT POINT LLC', nombreComercial: 'NEXT POINT LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '10300 NW 19th ST', ciudad: '', provincia: 'FL', pais: 'us', telefono: '1--7168471485', email: ''},
  {codigo: '0034', nombre: 'COMPUCELL SA', nombreComercial: 'COMPUCELL SA', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'AV MCAL LOPEZ Y CALLE 5', ciudad: '', provincia: 'CDE', pais: 'py', telefono: '61--578105', email: ''},
  {codigo: '0035', nombre: 'EMAP', nombreComercial: 'EMAP', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'AV CARLOS A LOPEZ', ciudad: '', provincia: 'CDE', pais: 'py', telefono: '3884041867', email: ''},
  {codigo: '0036', nombre: 'PACIFICO DIGITAL SpA', nombreComercial: 'PACIFICO DIGITAL SpA', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '3,5KM NORTE ZONA FRANCA', ciudad: '', provincia: 'MG', pais: 'cl', telefono: '56--612211659', email: ''},
  {codigo: '0037', nombre: 'GLOBAL BUSINESS COMPANY LLC', nombreComercial: 'GLOBAL BUSINESS COMPANY LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '4660 NW 79TH AVE APT 2C', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0038', nombre: 'BLANCO GARCIA SANTILLAN LLC', nombreComercial: 'BLANCO GARCIA SANTILLAN LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '8360 WEST FLAGLER ST APT 201', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0040', nombre: 'UNICENTER CORP.', nombreComercial: 'UNICENTER CORP.', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '9251 SW 60 STREET, MIAMI, FL 33173', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0041', nombre: 'IMPOEXPO 26 LLC', nombreComercial: 'IMPOEXPO 26 LLC', grupo: 'RS', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '3401 SW 160TH AVE, MIRAMAR, FL 33027', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0042', nombre: 'INTER-LAT CONSULTING', nombreComercial: 'INTER-LAT CONSULTING', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '7950 NW 53RD ST STE 337', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0044', nombre: 'LAN STORE LLC', nombreComercial: 'LAN STORE LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '12905 SW 42ND ST STE 210', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0047', nombre: 'MARCELO VICTOR VALIA', nombreComercial: 'MARCELO VICTOR VALIA', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'IBERA 1544 7C', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '3884041867', email: ''},
  {codigo: '0049', nombre: 'CMA INSUMOS SRL', nombreComercial: 'CMA INSUMOS SRL', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'IBER� 1544 7C', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '3884041867', email: ''},
  {codigo: '0051', nombre: 'GRIMIFER S.A.', nombreComercial: 'GRIMIFER S.A.', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '18 DE JULIO 2201', ciudad: '', provincia: 'MV', pais: 'uy', telefono: '598--24016057', email: 'equipodecompras@zonatecno.com.uy'},
  {codigo: '0054', nombre: 'CONNECTING PEOPLE SRL', nombreComercial: 'CONNECTING PEOPLE SRL', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'NU�EZ 1750 PB B', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '3884041867', email: ''},
  {codigo: '0056', nombre: 'GUSTAVO DANIEL CARDACI', nombreComercial: 'GUSTAVO DANIEL CARDACI', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'NU�EZ 2422 5 509', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '3884041867', email: ''},
  {codigo: '0057', nombre: 'DUTY FREE ELECTRONICS LLC', nombreComercial: 'DUTY FREE ELECTRONICS LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'Libertador', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0059', nombre: 'BA IMPORT SA', nombreComercial: 'BA IMPORT SA', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'Libertador', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '3884041867', email: ''},
  {codigo: '0060', nombre: 'ABSOLUTE TECNO LLC', nombreComercial: 'ABSOLUTE TECNO LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '2151 NE 155TH ST UNIT 2', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0061', nombre: 'BALIVA LLC', nombreComercial: 'BALIVA LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '7962 NW 14 ST.', ciudad: '', provincia: 'FL', pais: 'us', telefono: '7--864997014', email: 'david@bali-va.com'},
  {codigo: '0067', nombre: 'READY2TEK', nombreComercial: 'READY2TEK', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '8250 NW 25TH ST STE', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0069', nombre: 'NAHARI IMPORT EXPORT EAS', nombreComercial: 'NAHARI IMPORT EXPORT EAS', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'AV TENIENTE CABELLO N 559', ciudad: '', provincia: 'CDE', pais: 'py', telefono: '595--061502022', email: ''},
  {codigo: '0072', nombre: 'MAYORINTEC SRL', nombreComercial: 'MAYORINTEC SRL', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'AV BENI EDIFICIO TOP CENTER P 8 OF 8G', ciudad: '', provincia: 'SC', pais: 'bo', telefono: '3884041867', email: ''},
  {codigo: '0073', nombre: 'BS AS IMPORT LAT', nombreComercial: 'BS AS IMPORT LAT', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'AV LIBERTADOR 6299 10-13', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '3884041867', email: ''},
  {codigo: '0074', nombre: 'CELL TRADE INTERNATIONAL LLC', nombreComercial: 'CELL TRADE INTERNATIONAL LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '2020 NE 163RD ST STE 300D', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''},
  {codigo: '0075', nombre: 'YESSICA THANNER', nombreComercial: 'YESSICA THANNER', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'GRAL ROCA 1495 PISO 9 DEPTO C', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '54--91169605454', email: ''},
  {codigo: '0076', nombre: 'DIEGO ROS', nombreComercial: 'DIEGO ROS', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: 'VIRREY OLAGUER Y FELIU 5273 DEPTO FONDO', ciudad: '', provincia: 'BA', pais: 'ar', telefono: '54--91139370762', email: ''},
  {codigo: '0079', nombre: 'EOL EXPRESS LLC', nombreComercial: 'EOL EXPRESS LLC', grupo: 'ST', departamento: '', inscripcion: 'Exento Exterior', nroDocumento: '0', direccion: '7925 NW 12TH ST 109', ciudad: '', provincia: 'FL', pais: 'us', telefono: '3884041867', email: ''}
];

async function cargarClientes() {
  console.log(`📥 Iniciando carga de ${clientes.length} clientes a Firebase...`);

  let cargados = 0;
  let errores = 0;

  for (const cliente of clientes) {
    try {
      await db.collection('clientes').doc(cliente.codigo).set(cliente);
      cargados++;
      if (cargados % 10 === 0) {
        console.log(`✅ Cargados ${cargados}/${clientes.length}...`);
      }
    } catch (error) {
      errores++;
      console.error(`❌ Error cargando cliente ${cliente.codigo}:`, error.message);
    }
  }

  console.log(`\n🎉 Proceso completado!`);
  console.log(`✅ Clientes cargados: ${cargados}`);
  if (errores > 0) {
    console.log(`❌ Errores: ${errores}`);
  }

  process.exit(0);
}

cargarClientes();
