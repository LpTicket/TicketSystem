/**
 * LPTicket — Seed Script
 * Creates realistic Venezuelan events with venue sections and seats.
 *
 * Run:  npx ts-node -r tsconfig-paths/register src/database/seed.ts
 */

import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';
import { 
  User, UserRole, IdType, 
  Event, EventStatus, EventCategory, 
  VenueSection, SectionType, 
  Seat, SeatStatus 
} from './entities';


function rowLabel(n: number): string {
  return String.fromCharCode(64 + n); // 1→A, 2→B …
}

async function createSeats(
  ds: DataSource,
  sectionId: string,
  rows: number,
  seatsPerRow: number,
  soldPct = 0.3,
) {
  const seatRepo = ds.getRepository(Seat);
  const seats: Partial<Seat>[] = [];
  for (let r = 1; r <= rows; r++) {
    for (let s = 1; s <= seatsPerRow; s++) {
      const rnd = Math.random();
      let status: SeatStatus = SeatStatus.AVAILABLE;
      if (rnd < soldPct) status = SeatStatus.SOLD;
      seats.push({ sectionId, rowLabel: rowLabel(r), seatNumber: s, status });
    }
  }
  await seatRepo.save(seats);
}

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ DB connected');

  const userRepo = AppDataSource.getRepository(User);
  const eventRepo = AppDataSource.getRepository(Event);
  const sectionRepo = AppDataSource.getRepository(VenueSection);

  // ── Client user ─────────────────────────────────────────────────────────
  let organizer = await userRepo.findOne({ where: { email: 'organizer@lpticket.com' } });
  if (!organizer) {
    organizer = userRepo.create({
      email: 'organizer@lpticket.com',
      username: 'lpticket_org',
      passwordHash: await bcrypt.hash('123456', 10),
      firstName: 'Carlos',
      lastName: 'Organizador',
      idType: IdType.V,
      idNumber: '10000001',
      phone: '0412-1234567',
      role: UserRole.CLIENT,
      isActive: true,
    });
    organizer = await userRepo.save(organizer);
    console.log('✅ Client user created: organizer@lpticket.com / 123456');
  } else {
    console.log('ℹ️  Client user already exists');
  }

  // ── Admin user ──────────────────────────────────────────────────────────
  let admin = await userRepo.findOne({ where: { email: 'admin@lpticket.com' } });
  if (!admin) {
    admin = userRepo.create({
      email: 'admin@lpticket.com',
      username: 'lpticket_admin',
      passwordHash: await bcrypt.hash('12345678', 10),
      firstName: 'Admin',
      lastName: 'LPTicket',
      idType: IdType.V,
      idNumber: '10000000',
      phone: '0412-0000000',
      role: UserRole.ADMIN,
      isActive: true,
    });
    admin = await userRepo.save(admin);
    console.log('✅ Admin user created: admin@lpticket.com / 12345678');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // ── Helper: delete + recreate sections/seats for an event ─────────────────
  const resetEvent = async (slug: string) => {
    const ev = await eventRepo.findOne({ where: { slug } });
    if (ev) {
      // cascaded via FK
      await sectionRepo.delete({ eventId: ev.id });
      await eventRepo.delete(ev.id);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 1 — Soy Caribe SOY MEDITERRÁNEO @ Teatro Bellas Artes
  // ═══════════════════════════════════════════════════════════════════════════
  await resetEvent('soy-caribe-soy-mediterraneo');
  const ev1 = await eventRepo.save(
    eventRepo.create({
      title: 'Soy Caribe SOY MEDITERRÁNEO',
      slug: 'soy-caribe-soy-mediterraneo',
      description:
        'Un espectáculo único que fusiona los ritmos del Caribe con la música mediterránea. Una noche inolvidable en el icónico Teatro Bellas Artes de Caracas.',
      category: EventCategory.CONCIERTO,
      venueName: 'Teatro Bellas Artes',
      venueAddress: 'Plaza Morelos, Caracas, Venezuela',
      eventDate: new Date(Date.now() + 4 * 86400000).toISOString(),
      doorsOpen: new Date(Date.now() + 4 * 86400000 - 3600000).toISOString(),
      currency: 'USD',
      organizerId: organizer.id,
      status: EventStatus.PUBLISHED,
      isFeatured: true,
      minPrice: 20,
      maxPrice: 20,
      imageUrl: 'https://images.unsplash.com/photo-1540039155732-684735084730?w=800&q=80',
    }),
  );

  // Teatro layout — Balcón (seated) + Diamante (seated)
  const s1a = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev1.id, name: 'BALCÓN', sectionType: SectionType.SEATED,
      rows: 5, seatsPerRow: 22, capacity: 110, price: 20, color: '#ef4444',
      sortOrder: 0, mapX: 5, mapY: 5, mapWidth: 90, mapHeight: 30,
    }),
  );
  await createSeats(AppDataSource, s1a.id, 5, 22, 0.25);

  const s1b = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev1.id, name: 'DIAMANTE', sectionType: SectionType.VIP,
      rows: 12, seatsPerRow: 18, capacity: 216, price: 20, color: '#3b82f6',
      sortOrder: 1, mapX: 10, mapY: 40, mapWidth: 80, mapHeight: 50,
    }),
  );
  await createSeats(AppDataSource, s1b.id, 12, 18, 0.4);

  await eventRepo.update(ev1.id, { minPrice: 20, maxPrice: 20 });
  console.log('✅ Event 1 created: Soy Caribe SOY MEDITERRÁNEO');

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 2 — Noche de Salsa con Oscar D'León @ Teatro Baralt
  // ═══════════════════════════════════════════════════════════════════════════
  await resetEvent('noche-de-salsa-oscar-dleon');
  const ev2 = await eventRepo.save(
    eventRepo.create({
      title: "Noche de Salsa con Oscar D'León",
      slug: 'noche-de-salsa-oscar-dleon',
      description:
        "El rey de la salsa venezolana regresa al histórico Teatro Baralt de Maracaibo con un show inigualable. No te pierdas esta noche épica.",
      category: EventCategory.CONCIERTO,
      venueName: 'Teatro Baralt',
      venueAddress: 'Av. Venezuela, Maracaibo, Venezuela',
      eventDate: new Date(Date.now() + 9 * 86400000).toISOString(),
      doorsOpen: new Date(Date.now() + 9 * 86400000 - 3600000).toISOString(),
      currency: 'USD',
      organizerId: organizer.id,
      status: EventStatus.PUBLISHED,
      isFeatured: true,
      minPrice: 15,
      maxPrice: 25,
      imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80',
    }),
  );

  // Teatro Baralt layout — 4 sections
  const s2a = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev2.id, name: 'PALCO I', sectionType: SectionType.VIP,
      rows: 3, seatsPerRow: 8, capacity: 24, price: 15, color: '#22c55e',
      sortOrder: 0, mapX: 2, mapY: 2, mapWidth: 35, mapHeight: 20,
    }),
  );
  await createSeats(AppDataSource, s2a.id, 3, 8, 0.5);

  const s2b = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev2.id, name: 'PALCO II', sectionType: SectionType.VIP,
      rows: 3, seatsPerRow: 8, capacity: 24, price: 15, color: '#22c55e',
      sortOrder: 1, mapX: 63, mapY: 2, mapWidth: 35, mapHeight: 20,
    }),
  );
  await createSeats(AppDataSource, s2b.id, 3, 8, 0.5);

  const s2c = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev2.id, name: 'PLATINUM', sectionType: SectionType.SEATED,
      rows: 14, seatsPerRow: 20, capacity: 280, price: 20, color: '#f97316',
      sortOrder: 2, mapX: 5, mapY: 25, mapWidth: 90, mapHeight: 45,
    }),
  );
  await createSeats(AppDataSource, s2c.id, 14, 20, 0.35);

  const s2d = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev2.id, name: 'DIAMANTE', sectionType: SectionType.SEATED,
      rows: 5, seatsPerRow: 24, capacity: 120, price: 25, color: '#06b6d4',
      sortOrder: 3, mapX: 5, mapY: 73, mapWidth: 90, mapHeight: 22,
    }),
  );
  await createSeats(AppDataSource, s2d.id, 5, 24, 0.2);

  await eventRepo.update(ev2.id, { minPrice: 15, maxPrice: 25 });
  console.log("✅ Event 2 created: Noche de Salsa con Oscar D'León");

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 3 — ¡NO ME JODAS! Stand Up Comedy
  // ═══════════════════════════════════════════════════════════════════════════
  await resetEvent('no-me-jodas-stand-up');
  const ev3 = await eventRepo.save(
    eventRepo.create({
      title: '¡NO ME JODAS! Stand Up Comedy',
      slug: 'no-me-jodas-stand-up',
      description:
        'La noche de comedia más esperada del año. Los mejores comediantes del país en una noche de risas garantizadas. Apto para mayores de 18 años.',
      category: EventCategory.COMEDIA,
      venueName: 'V-House Grill & Bar',
      venueAddress: 'CCCT, Caracas, Venezuela',
      eventDate: new Date(Date.now() + 12 * 86400000).toISOString(),
      doorsOpen: new Date(Date.now() + 12 * 86400000 - 5400000).toISOString(),
      currency: 'USD',
      organizerId: organizer.id,
      status: EventStatus.PUBLISHED,
      isFeatured: false,
      minPrice: 20,
      maxPrice: 35,
      imageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&q=80',
    }),
  );

  const s3a = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev3.id, name: 'VIP', sectionType: SectionType.VIP,
      rows: 4, seatsPerRow: 10, capacity: 40, price: 35, color: '#a855f7',
      sortOrder: 0, mapX: 20, mapY: 5, mapWidth: 60, mapHeight: 30,
    }),
  );
  await createSeats(AppDataSource, s3a.id, 4, 10, 0.6);

  const s3b = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev3.id, name: 'GENERAL', sectionType: SectionType.SEATED,
      rows: 8, seatsPerRow: 16, capacity: 128, price: 20, color: '#6366f1',
      sortOrder: 1, mapX: 10, mapY: 40, mapWidth: 80, mapHeight: 50,
    }),
  );
  await createSeats(AppDataSource, s3b.id, 8, 16, 0.2);

  await eventRepo.update(ev3.id, { minPrice: 20, maxPrice: 35 });
  console.log('✅ Event 3 created: ¡NO ME JODAS! Stand Up Comedy');

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 4 — El Fantasma de la Ópera
  // ═══════════════════════════════════════════════════════════════════════════
  await resetEvent('el-fantasma-de-la-opera');
  const ev4 = await eventRepo.save(
    eventRepo.create({
      title: 'El Fantasma de la Ópera',
      slug: 'el-fantasma-de-la-opera',
      description:
        'La obra musical más famosa del mundo llega a Venezuela. Una producción de clase mundial con impresionantes sets, vestuarios y efectos especiales. Un evento imperdible para toda la familia.',
      category: EventCategory.TEATRO,
      venueName: 'Teatro Municipal de Caracas',
      venueAddress: 'Esquina del Teatro, Caracas, Venezuela',
      eventDate: new Date(Date.now() + 18 * 86400000).toISOString(),
      doorsOpen: new Date(Date.now() + 18 * 86400000 - 3600000).toISOString(),
      currency: 'USD',
      organizerId: organizer.id,
      status: EventStatus.PUBLISHED,
      isFeatured: false,
      minPrice: 25,
      maxPrice: 50,
      imageUrl: 'https://images.unsplash.com/photo-1507676184212-d0330a15233c?w=800&q=80',
    }),
  );

  const s4a = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev4.id, name: 'PREFERENCIA', sectionType: SectionType.VIP,
      rows: 4, seatsPerRow: 16, capacity: 64, price: 50, color: '#eab308',
      sortOrder: 0, mapX: 10, mapY: 5, mapWidth: 80, mapHeight: 20,
    }),
  );
  await createSeats(AppDataSource, s4a.id, 4, 16, 0.7);

  const s4b = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev4.id, name: 'PLATEA', sectionType: SectionType.SEATED,
      rows: 14, seatsPerRow: 22, capacity: 308, price: 35, color: '#6366f1',
      sortOrder: 1, mapX: 5, mapY: 28, mapWidth: 90, mapHeight: 50,
    }),
  );
  await createSeats(AppDataSource, s4b.id, 14, 22, 0.45);

  const s4c = await sectionRepo.save(
    sectionRepo.create({
      eventId: ev4.id, name: 'BALCÓN', sectionType: SectionType.SEATED,
      rows: 5, seatsPerRow: 20, capacity: 100, price: 25, color: '#ef4444',
      sortOrder: 2, mapX: 8, mapY: 82, mapWidth: 84, mapHeight: 13,
    }),
  );
  await createSeats(AppDataSource, s4c.id, 5, 20, 0.15);

  await eventRepo.update(ev4.id, { minPrice: 25, maxPrice: 50 });
  console.log('✅ Event 4 created: El Fantasma de la Ópera');

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 5 — Festival de Jazz Nocturno
  // ═══════════════════════════════════════════════════════════════════════════
  await resetEvent('festival-jazz-nocturno');
  const ev5 = await eventRepo.save(
    eventRepo.create({
      title: 'Festival de Jazz Nocturno',
      slug: 'festival-jazz-nocturno',
      description: 'Disfruta de las mejores bandas de jazz bajo la luz de las estrellas.',
      category: EventCategory.CONCIERTO,
      venueName: 'Centro de Arte',
      venueAddress: 'Valencia, Venezuela',
      eventDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      currency: 'USD',
      organizerId: organizer.id,
      status: EventStatus.PUBLISHED,
      isFeatured: false,
      minPrice: 30,
      maxPrice: 30,
      imageUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80',
    }),
  );
  const s5a = await sectionRepo.save(sectionRepo.create({ eventId: ev5.id, name: 'GENERAL', sectionType: SectionType.SEATED, rows: 5, seatsPerRow: 10, capacity: 50, price: 30, color: '#6366f1', sortOrder: 0, mapX: 10, mapY: 10, mapWidth: 80, mapHeight: 80 }));
  await createSeats(AppDataSource, s5a.id, 5, 10, 0.2);

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 6 — Gran Final — Copa Nacional
  // ═══════════════════════════════════════════════════════════════════════════
  await resetEvent('copa-nacional-final');
  const ev6 = await eventRepo.save(
    eventRepo.create({
      title: 'Gran Final — Copa Nacional',
      slug: 'copa-nacional-final',
      description: 'El partido decisivo de la temporada. ¡No te quedes sin tu entrada!',
      category: EventCategory.DEPORTE,
      venueName: 'Estadio Pachencho Romero',
      venueAddress: 'Maracaibo, Venezuela',
      eventDate: new Date(Date.now() + 12 * 86400000).toISOString(),
      currency: 'USD',
      organizerId: organizer.id,
      status: EventStatus.PUBLISHED,
      isFeatured: false,
      minPrice: 10,
      maxPrice: 10,
      imageUrl: 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=800&q=80',
    }),
  );
  const s6a = await sectionRepo.save(sectionRepo.create({ eventId: ev6.id, name: 'TRIBUNAS', sectionType: SectionType.SEATED, rows: 10, seatsPerRow: 20, capacity: 200, price: 10, color: '#10b981', sortOrder: 0, mapX: 5, mapY: 5, mapWidth: 90, mapHeight: 90 }));
  await createSeats(AppDataSource, s6a.id, 10, 20, 0.6);

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 7 — Obra de Teatro Infantil: El Mundo de Oz
  // ═══════════════════════════════════════════════════════════════════════════
  await resetEvent('mundo-oz-infantil');
  const ev7 = await eventRepo.save(
    eventRepo.create({
      title: 'Obra de Teatro Infantil: El Mundo de Oz',
      slug: 'mundo-oz-infantil',
      description: 'Una mágica aventura para los más pequeños de la casa.',
      category: EventCategory.INFANTIL,
      venueName: 'Teatro Municipal',
      venueAddress: 'Barquisimeto, Venezuela',
      eventDate: new Date(Date.now() + 8 * 86400000).toISOString(),
      currency: 'USD',
      organizerId: organizer.id,
      status: EventStatus.PUBLISHED,
      isFeatured: false,
      minPrice: 8,
      maxPrice: 8,
      imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    }),
  );
  const s7a = await sectionRepo.save(sectionRepo.create({ eventId: ev7.id, name: 'GENERAL', sectionType: SectionType.SEATED, rows: 6, seatsPerRow: 15, capacity: 90, price: 8, color: '#f43f5e', sortOrder: 0, mapX: 10, mapY: 10, mapWidth: 80, mapHeight: 80 }));
  await createSeats(AppDataSource, s7a.id, 6, 15, 0.4);

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT 8 — Campeonato de Fútbol Sala
  // ═══════════════════════════════════════════════════════════════════════════
  await resetEvent('futbol-sala');
  const ev8 = await eventRepo.save(
    eventRepo.create({
      title: 'Campeonato de Fútbol Sala',
      slug: 'futbol-sala',
      description: 'Ven a apoyar a tu equipo local en el torneo relámpago de Fútbol Sala.',
      category: EventCategory.DEPORTE,
      venueName: 'Polideportivo Municipal',
      venueAddress: 'Mérida, Venezuela',
      eventDate: new Date(Date.now() + 15 * 86400000).toISOString(),
      currency: 'USD',
      organizerId: organizer.id,
      status: EventStatus.PUBLISHED,
      isFeatured: false,
      minPrice: 5,
      maxPrice: 5,
      imageUrl: 'https://images.unsplash.com/photo-1536560035542-1326fab3a507?w=800&q=80',
    }),
  );
  const s8a = await sectionRepo.save(sectionRepo.create({ eventId: ev8.id, name: 'GENERAL', sectionType: SectionType.SEATED, rows: 4, seatsPerRow: 25, capacity: 100, price: 5, color: '#3b82f6', sortOrder: 0, mapX: 5, mapY: 5, mapWidth: 90, mapHeight: 90 }));
  await createSeats(AppDataSource, s8a.id, 4, 25, 0.3);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed completed successfully!');
  console.log('   Admin login: admin@lpticket.com / 12345678');
  console.log('   Organizer login: organizer@lpticket.com / 123456');
  console.log('   8 events created with sections and seats\n');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
