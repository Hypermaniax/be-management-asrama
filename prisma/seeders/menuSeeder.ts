import { prisma } from "../../src/lib/prisma.ts";

export type MenuSeed = {
  code: string;
  name: string;
  path: string;
  icon?: string;
  sortOrder: number;
  children?: MenuSeed[];
};

export const MENUS: MenuSeed[] = [
  { code: "dashboard", name: "Dashboard", path: "/dashboard", sortOrder: 1 },
  {
    code: "master",
    name: "Data Master",
    path: "#",
    sortOrder: 2,
    children: [
      { code: "master.building", name: "Gedung", path: "/master/buildings", sortOrder: 1 },
      { code: "master.room", name: "Kamar", path: "/master/rooms", sortOrder: 2 },
      {
        code: "master.roomFacility",
        name: "Fasilitas Kamar",
        path: "/master/room-facilities",
        sortOrder: 3,
      },
      {
        code: "master.publicFacility",
        name: "Fasilitas Umum",
        path: "/master/public-facilities",
        sortOrder: 4,
      },
      { code: "master.feeRule", name: "Aturan Biaya", path: "/master/fee-rules", sortOrder: 5 },
      {
        code: "master.category",
        name: "Kategori Kas",
        path: "/master/categories",
        sortOrder: 6,
      },
    ],
  },
  {
    code: "resident",
    name: "Penghuni",
    path: "#",
    sortOrder: 3,
    children: [
      {
        code: "resident.applicant",
        name: "Pendaftar/Calon",
        path: "/residents/applicants",
        sortOrder: 1,
      },
      { code: "resident.list", name: "Data Penghuni", path: "/residents", sortOrder: 2 },
      {
        code: "resident.occupancy",
        name: "Penempatan Kamar",
        path: "/residents/occupancies",
        sortOrder: 3,
      },
      {
        code: "resident.document",
        name: "Verifikasi Dokumen",
        path: "/residents/documents",
        sortOrder: 4,
      },
    ],
  },
  {
    code: "finance",
    name: "Keuangan",
    path: "#",
    sortOrder: 4,
    children: [
      { code: "finance.invoice", name: "Tagihan", path: "/finance/invoices", sortOrder: 1 },
      { code: "finance.payment", name: "Pembayaran", path: "/finance/payments", sortOrder: 2 },
      { code: "finance.expense", name: "Pengeluaran", path: "/finance/expenses", sortOrder: 3 },
      { code: "finance.cash", name: "Buku Kas", path: "/finance/cash", sortOrder: 4 },
      { code: "finance.report", name: "Laporan Keuangan", path: "/finance/reports", sortOrder: 5 },
    ],
  },
  {
    code: "organization",
    name: "Organisasi",
    path: "#",
    sortOrder: 5,
    children: [
      {
        code: "organization.period",
        name: "Periode",
        path: "/organization/periods",
        sortOrder: 1,
      },
      {
        code: "organization.position",
        name: "Jabatan",
        path: "/organization/positions",
        sortOrder: 2,
      },
      {
        code: "organization.assign",
        name: "Penugasan",
        path: "/organization/assignments",
        sortOrder: 3,
      },
    ],
  },
  {
    code: "event",
    name: "Kegiatan",
    path: "#",
    sortOrder: 6,
    children: [
      { code: "event.list", name: "Daftar Kegiatan", path: "/events", sortOrder: 1 },
      { code: "event.session", name: "Sesi/Agenda", path: "/events/sessions", sortOrder: 2 },
      { code: "event.committee", name: "Panitia", path: "/events/committees", sortOrder: 3 },
      { code: "event.attendance", name: "Absensi", path: "/events/attendance", sortOrder: 4 },
      { code: "event.attachment", name: "Lampiran/LPJ", path: "/events/attachments", sortOrder: 5 },
    ],
  },
  {
    code: "election",
    name: "Pemilihan",
    path: "#",
    sortOrder: 7,
    children: [
      { code: "election.list", name: "Daftar Pemilihan", path: "/elections", sortOrder: 1 },
      {
        code: "election.candidate",
        name: "Kandidat",
        path: "/elections/candidates",
        sortOrder: 2,
      },
      {
        code: "election.eligible",
        name: "Pemilih (eligible)",
        path: "/elections/eligible",
        sortOrder: 3,
      },
      { code: "election.result", name: "Hasil", path: "/elections/results", sortOrder: 4 },
    ],
  },
  {
    code: "system",
    name: "Sistem",
    path: "#",
    sortOrder: 8,
    children: [
      { code: "system.user", name: "Pengguna", path: "/system/users", sortOrder: 1 },
      { code: "system.role", name: "Role", path: "/system/roles", sortOrder: 2 },
      { code: "system.permission", name: "Permission", path: "/system/permissions", sortOrder: 3 },
      { code: "system.menu", name: "Menu", path: "/system/menus", sortOrder: 4 },
      { code: "system.audit", name: "Audit Log", path: "/system/audit", sortOrder: 5 },
    ],
  },
  {
    code: "me",
    name: "Akun Saya",
    path: "#",
    sortOrder: 9,
    children: [
      { code: "me.profile", name: "Profil Saya", path: "/me/profile", sortOrder: 1 },
      { code: "me.invoice", name: "Tagihan Saya", path: "/me/invoices", sortOrder: 2 },
      { code: "me.document", name: "Dokumen Saya", path: "/me/documents", sortOrder: 3 },
      { code: "me.attendance", name: "Absensi Saya", path: "/me/attendance", sortOrder: 4 },
      { code: "me.election", name: "Pemilihan Saya", path: "/me/elections", sortOrder: 5 },
    ],
  },
];

export const flattenMenus = (menus: MenuSeed[]): MenuSeed[] =>
  menus.flatMap((menu) => [menu, ...(menu.children ?? [])]);

export const ALL_MENU_CODES = flattenMenus(MENUS).map((menu) => menu.code);

export async function seedMenus() {
  const idByCode = new Map<string, string>();

  for (const root of MENUS) {
    const parent = await prisma.menu.upsert({
      where: { code: root.code },
      create: {
        code: root.code,
        name: root.name,
        path: root.path,
        icon: root.icon ?? null,
        sortOrder: root.sortOrder,
        parentId: null,
      },
      update: {
        name: root.name,
        path: root.path,
        icon: root.icon ?? null,
        sortOrder: root.sortOrder,
        parentId: null,
      },
    });
    idByCode.set(root.code, parent.id);

    for (const child of root.children ?? []) {
      const created = await prisma.menu.upsert({
        where: { code: child.code },
        create: {
          code: child.code,
          name: child.name,
          path: child.path,
          icon: child.icon ?? null,
          sortOrder: child.sortOrder,
          parentId: parent.id,
        },
        update: {
          name: child.name,
          path: child.path,
          icon: child.icon ?? null,
          sortOrder: child.sortOrder,
          parentId: parent.id,
        },
      });
      idByCode.set(child.code, created.id);
    }
  }

  console.log(`seeded ${idByCode.size} menus`);
  return idByCode;
}
