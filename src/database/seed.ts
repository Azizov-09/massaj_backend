import {
  PrismaClient,
  Role,
  UserStatus,
  SpecialistStatus,
  EmployeeStatus,
  ServiceStatus,
  AttendanceStatus,
  GoalStatus,
  PaymentMethod,
  TransactionType,
  TransactionDirection,
  NotificationType,
  NotificationPriority,
  Gender,
  Prisma,
} from '@prisma/client';
import * as argon2 from 'argon2';

export async function seedDatabase(prisma: PrismaClient, force = false): Promise<void> {
  console.log('[Seed] Starting database seeding process...');

  const userCount = await prisma.user.count();
  if (userCount >= 50 && !force) {
    console.log(`[Seed] Database already contains ${userCount} users. Skipping seeding to prevent duplicate data.`);
    return;
  }

  console.log('[Seed] Generating password hashes with Argon2id...');
  const commonHash = await argon2.hash('Password123!', { type: argon2.argon2id });
  const adminHash = await argon2.hash('Admin123!', { type: argon2.argon2id });

  // 1. Center Settings
  console.log('[Seed] 1/12 Creating Center Settings...');
  const existingCenter = await prisma.centerSettings.findFirst();
  if (!existingCenter) {
    await prisma.centerSettings.create({
      data: {
        centerName: "Toshkent Bolalar Massaj va Reabilitatsiya Markazi",
        phone: "+998712001122",
        address: "Toshkent sh., Yunusobod tumani, Amir Temur shox ko'chasi, 45-uy",
        currency: "UZS",
        timezone: "Asia/Tashkent",
        workingHours: {
          monday: { open: "08:00", close: "19:00" },
          tuesday: { open: "08:00", close: "19:00" },
          wednesday: { open: "08:00", close: "19:00" },
          thursday: { open: "08:00", close: "19:00" },
          friday: { open: "08:00", close: "19:00" },
          saturday: { open: "09:00", close: "16:00" },
          sunday: "closed",
        },
      },
    });
  }

  // 2. Admins (50 admins: 1 SUPER_ADMIN + 49 ADMIN)
  console.log('[Seed] 2/12 Seeding 50 Admins...');
  const adminFirstNames = [
    'Javohir', 'Sardor', 'Bobur', 'Akmal', 'Rustam', 'Jamshid', 'Dilshod', 'Shavkat',
    'Farrux', 'Ulugbek', 'Otabek', 'Bekzod', 'Sanjar', 'Davron', 'Shohruh', 'Nodir',
    'Sherzod', 'Mansur', 'Azizbek', 'Eldor', 'Umid', 'Muzaffar', 'Ilhom', 'Anvar',
    'Bahodir', 'Kamol', 'Zohid', 'Ravshan', 'Botir', 'Asadbek', 'Shahboz', 'Mirjalol',
    'Temur', 'Xurshid', 'Doston', 'Doniyor', 'Oybek', 'Jasur', 'Sarvar', 'Abror',
    'Abbos', 'Sunnat', 'Alisher', 'Golib', 'Nurlan', 'Iskandar', 'Siroj', 'Farhod',
    'Hamid', 'Botirxon'
  ];
  const lastNames = [
    'Karimov', 'Rahimov', 'Usmonov', 'Aliyev', 'Tursunov', 'Sodiqov', 'Ahmedov',
    'Qodirov', 'Xalilov', 'Mirzayev', 'Yusupov', 'Nazarov', 'Boboyev', 'Shokirov',
    'Ibragimov', 'Murodov', 'Bekmurodov', 'Rustamov', 'Ergashev', 'Sobirov',
    'Qosimov', 'Norov', 'Madaminov', 'Polatov', 'Nematov', 'Jo\'rayev', 'Olimov',
    'Saidov', 'Rahmatullayev', 'Toshpulatov'
  ];

  for (let i = 1; i <= 50; i++) {
    const phone = `+99890100${i.toString().padStart(4, '0')}`;
    const isSuper = i === 1;
    const email = isSuper ? 'admin@massaj.uz' : `admin${i}@massaj.uz`;
    const fName = adminFirstNames[(i - 1) % adminFirstNames.length] ?? 'Admin';
    const lName = lastNames[(i - 1) % lastNames.length] ?? 'Menejer';
    const fullName = isSuper ? 'Bosh Administrator (Super)' : `${fName} ${lName}`;

    await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        fullName,
        phone,
        email,
        passwordHash: adminHash,
        role: isSuper ? Role.SUPER_ADMIN : Role.ADMIN,
        status: UserStatus.ACTIVE,
        admin: {
          create: {},
        },
      },
    });
  }

  // 3. Specialists (50 specialists)
  console.log('[Seed] 3/12 Seeding 50 Specialists...');
  const specFirstNames = [
    'Zilola', 'Nigora', 'Shahnoza', 'Feruza', 'Gulnoza', 'Malika', 'Dilnoza', 'Sevara',
    'Barno', 'Mohira', 'Shaxrizoda', 'Munisa', 'Zulayxo', 'Nasiba', 'Oydin', 'Kamola',
    'Nodira', 'Ra\'no', 'Saida', 'Gulsanam', 'Rayhon', 'Lola', 'Dildora', 'Muattar',
    'Umida', 'Nafisa', 'Aziza', 'Iroda', 'Go\'zal', 'Dilsora', 'Gulbahor', 'Fotima',
    'Zuhra', 'Shoira', 'Mavluda', 'Nargiza', 'Zarina', 'Madina', 'Surayyo', 'Lobor',
    'Gavhar', 'Kumush', 'Sabina', 'Gulchehra', 'Munavvar', 'Hulkar', 'Sanobar', 'Mastura',
    'Oygul', 'Dilfuza'
  ];
  const specializations = [
    'Bolalar bosh massajisti',
    'Kichik yoshdagi bolalar reabilitologi',
    'Bolalar nevrolog-massajisti',
    'Fizioterapevt va LFK instruktori',
    'Skolioz va qomat buzilishlari mutaxassisi',
    'Krivosheya (bo\'yin qiyshiqligi) mutaxassisi',
    'Gidroterapevt va basseyn instruktori',
    'Bolalar osteopati',
    'Miopatiya va gipotoniya bo\'yicha kineziterapevt',
    'Logopedik artikulyatsion massaj ustasi'
  ];

  const specialistRecords: { id: string; userId: string; fullName: string }[] = [];

  for (let i = 1; i <= 50; i++) {
    const phone = `+99890200${i.toString().padStart(4, '0')}`;
    const fName = specFirstNames[(i - 1) % specFirstNames.length] ?? 'Mutaxassis';
    const lName = lastNames[(i + 3) % lastNames.length] ?? 'Shifokor';
    const fullName = `Dr. ${fName} ${lName}`;
    const specialization = specializations[(i - 1) % specializations.length] ?? 'Bolalar massajisti';
    const experienceYears = 2 + (i % 15);

    let user = await prisma.user.findUnique({
      where: { phone },
      include: { specialist: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName,
          phone,
          email: `specialist${i}@massaj.uz`,
          passwordHash: commonHash,
          role: Role.SPECIALIST,
          status: UserStatus.ACTIVE,
          specialist: {
            create: {
              specialization,
              experienceYears,
              bio: `${specialization} bo'yicha ${experienceYears} yillik amaliy tajribaga ega shifokor.`,
              status: SpecialistStatus.ACTIVE,
            },
          },
        },
        include: { specialist: true },
      });
    }

    if (user.specialist) {
      specialistRecords.push({ id: user.specialist.id, userId: user.id, fullName: user.fullName });
    }
  }

  // 4. Parents (50 parents)
  console.log('[Seed] 4/12 Seeding 50 Parents...');
  const parentFirstNames = [
    'Dilnoza', 'Alisher', 'Nargiza', 'Sardor', 'Gulrux', 'Jamoliddin', 'Barnoxon', 'Sherzod',
    'Shahnoza', 'Otabek', 'Muhayyo', 'Bekzod', 'Umida', 'Farhod', 'Nodira', 'Jasurbek',
    'Zulfiya', 'Temurbek', 'Nilufar', 'Shavkatbek', 'Ozoda', 'Ulugbek', 'Madina', 'Bobur',
    'Rayhonaxon', 'Sanjar', 'Gulinur', 'Mansurbek', 'Shohista', 'Doniyor', 'Feruzaxon', 'Akrom',
    'Ziyoda', 'Muzaffar', 'Dildora', 'Rustambek', 'Shahzoda', 'Ilhom', 'Munira', 'Davronbek',
    'Kamola', 'Shohruh', 'Lobarxon', 'Azizbek', 'Nazokat', 'Eldor', 'Gulbahor', 'Abrorbek',
    'Robiya', 'Bahodir'
  ];
  const tashkentDistricts = [
    'Yunusobod tumani, 4-mavze, 12-uy',
    'Chilonzor tumani, 9-mavze, 45-uy',
    'Mirzo Ulug\'bek tumani, Buyuk Ipak Yo\'li ko\'chasi, 88-uy',
    'Yakkasaroy tumani, Shota Rustaveli ko\'chasi, 23-uy',
    'Shayxontohur tumani, Labzak ko\'chasi, 15-uy',
    'Sergeli tumani, 2-mavze, 7-uy',
    'Olmazor tumani, Qorasaroy ko\'chasi, 34-uy',
    'Uchtepa tumani, 11-mavze, 19-uy',
    'Mirobod tumani, Nukus ko\'chasi, 56-uy',
    'Yashnobod tumani, Aviasozlar ko\'chasi, 10-uy'
  ];

  const parentRecords: { id: string; userId: string; fullName: string }[] = [];

  for (let i = 1; i <= 50; i++) {
    const phone = `+99890300${i.toString().padStart(4, '0')}`;
    const fName = parentFirstNames[(i - 1) % parentFirstNames.length] ?? 'Ota-ona';
    const lName = lastNames[(i + 7) % lastNames.length] ?? 'Valiyev';
    const fullName = `${fName} ${lName}`;
    const address = tashkentDistricts[(i - 1) % tashkentDistricts.length] ?? 'Toshkent sh.';

    let user = await prisma.user.findUnique({
      where: { phone },
      include: { parent: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName,
          phone,
          email: `parent${i}@gmail.com`,
          passwordHash: commonHash,
          role: Role.PARENT,
          status: UserStatus.ACTIVE,
          parent: {
            create: {
              address,
            },
          },
        },
        include: { parent: true },
      });
    }

    if (user.parent) {
      parentRecords.push({ id: user.parent.id, userId: user.id, fullName: user.fullName });
    }
  }

  // 5. Children (50 children, assigned to parents)
  console.log('[Seed] 5/12 Seeding 50 Children and ChildParent relations...');
  const childFirstNamesBoy = [
    'Amirbek', 'Jasur', 'Bilol', 'Imron', 'Muhammadali', 'Temur', 'Shahzod', 'Mustafo',
    'Ibrohim', 'Yusuf', 'Ali', 'Umar', 'Abdulloh', 'Davron', 'Islombek', 'Daler',
    'Ozodbek', 'Shaxriyor', 'Behruz', 'Suhrob', 'Akobir', 'Sardorbek', 'Shohjahon', 'Boburbek', 'Samandar'
  ];
  const childFirstNamesGirl = [
    'Madinabonu', 'Diyora', 'Muslima', 'Shahrizoda', 'Fotimaxon', 'Zuhraxon', 'Rayhona', 'Jasmina',
    'Imona', 'Safiya', 'Robiyaxon', 'Solixa', 'Gulasal', 'Zilolaxon', 'Shukrona', 'Maryam',
    'Guldona', 'Asaloy', 'Farangiz', 'Nozimaxon', 'Sumayya', 'Oysha', 'Parizoda', 'Sevinch', 'Hadicha'
  ];
  const diagnoses = [
    'Bo\'yin qiyshiqligi (Mushtarak tortikollis/krivosheya)',
    'Oyoq panjalarining ichkariga buralishi (Varus deformatsiya)',
    '1-darajali skolioz va qomat zaifligi',
    'Mushaklar gipotonusi (Mushak bo\'shashishi)',
    'Mushaklar gipertonusi (Ortiqcha taranglik)',
    'Raxit oqibatlari va harakat sustligi',
    'Chanoq-son bo\'g\'imi displaziyasi (tiklanish davri)',
    'Umumiy harakat rivojlanishidan ortda qolish',
    'Yassi oyoqlik (Ploskostopiye) 2-bosqich',
    'Miopatiya sindromi, LFK va massaj kursi'
  ];

  const childRecords: { id: string; firstName: string; lastName: string; parentId: string }[] = [];

  for (let i = 1; i <= 50; i++) {
    const isBoy = i % 2 === 1;
    const boyListIndex = Math.floor((i - 1) / 2) % childFirstNamesBoy.length;
    const girlListIndex = Math.floor((i - 1) / 2) % childFirstNamesGirl.length;
    const firstName = isBoy
      ? (childFirstNamesBoy[boyListIndex] ?? 'Amir')
      : (childFirstNamesGirl[girlListIndex] ?? 'Madina');
    const lastName = lastNames[(i + 5) % lastNames.length] ?? 'Aliyev';
    const gender = isBoy ? Gender.MALE : Gender.FEMALE;

    const ageInMonths = 6 + (i * 2);
    const birthDate = new Date();
    birthDate.setMonth(birthDate.getMonth() - ageInMonths);

    const diagnosis = diagnoses[(i - 1) % diagnoses.length] ?? 'Bolalar massaji kursi';
    const assignedParent = parentRecords[(i - 1) % parentRecords.length];

    let child = await prisma.child.findFirst({
      where: {
        firstName,
        lastName,
        gender,
      },
    });

    if (!child) {
      child = await prisma.child.create({
        data: {
          firstName,
          lastName,
          birthDate,
          gender,
          address: assignedParent ? (tashkentDistricts[(i - 1) % tashkentDistricts.length] ?? 'Toshkent sh.') : 'Toshkent sh.',
          notes: `Tashxis: ${diagnosis}. Massaj va reabilitatsiya kursi buyurilgan.`,
          parents: assignedParent
            ? {
                create: {
                  parentId: assignedParent.id,
                  relationship: isBoy ? 'Ona' : 'Ota',
                  isPrimary: true,
                },
              }
            : undefined,
        },
      });
    }

    if (assignedParent) {
      childRecords.push({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
        parentId: assignedParent.id,
      });
    }
  }

  // 6. Employees (50 non-medical staff)
  console.log('[Seed] 6/12 Seeding 50 Non-medical Employees...');
  const positions = [
    'Qabulxona bosh ma\'muri (Katta resepshn)',
    'Resepshn ma\'muri',
    'Katta hamshira',
    'Muolaja hamshirasi',
    'Bosh hisobchi',
    'Hisobchi-kassir',
    'Massaj xonasi assistenti',
    'Xo\'jalik mudiri (Zavxoz)',
    'Sanitariya va tozalik xodimi',
    'Mijozlar bilan aloqa menejeri (Call center)',
    'IT-tizim ma\'muri',
    'Oziq-ovqat va fito-bar nazoratchisi'
  ];

  for (let i = 1; i <= 50; i++) {
    const phone = `+99890400${i.toString().padStart(4, '0')}`;
    const pos = positions[(i - 1) % positions.length] ?? 'Xodim';
    const salary = 3500000 + ((i % 10) * 800000);
    const fName = adminFirstNames[(i + 4) % adminFirstNames.length] ?? 'Xodim';
    const lName = lastNames[(i + 12) % lastNames.length] ?? 'Azimov';
    const fullName = `${fName} ${lName}`;

    const existingEmp = await prisma.employee.findFirst({ where: { phone } });
    if (!existingEmp) {
      await prisma.employee.create({
        data: {
          fullName,
          position: pos,
          phone,
          email: `employee${i}@massaj.uz`,
          status: EmployeeStatus.ACTIVE,
          salary: new Prisma.Decimal(salary),
          notes: `${pos} lavozimida faoliyat yuritadi. Mehnat shartnomasi asosida.`,
        },
      });
    }
  }

  // 7. Services (15 clinic massage and therapy services)
  console.log('[Seed] 7/12 Seeding 15 Clinic Services...');
  const servicesData = [
    {
      name: 'Chaqaloqlar umumiy rivojlantiruvchi massaji',
      description: '1 yoshgacha bo\'lgan go\'daklar uchun mushak tonusini yaxshilovchi umumiy klassik massaj',
      durationMinutes: 30,
      price: 150000,
    },
    {
      name: 'Krivosheya (Bo\'yin qiyshiqligi) davolovchi massaji',
      description: 'Bo\'yin mushaklari spastikasini yengillashtirish va to\'g\'ri simmetriyani tiklash kursi',
      durationMinutes: 40,
      price: 180000,
    },
    {
      name: 'Chanoq-son displaziyasi profilaktika massaji',
      description: 'Chanoq bo\'g\'imini to\'g\'ri shakllanishiga yordam beruvchi maxsus terapevtik massaj',
      durationMinutes: 45,
      price: 200000,
    },
    {
      name: 'Skolioz va qomat buzilishlari reabilitatsiyasi',
      description: 'Orqa mushak korsetini kuchaytirish va umurtqa pog\'onasi egriliklarini tuzatish kursi',
      durationMinutes: 50,
      price: 220000,
    },
    {
      name: 'DCP (Bosh miya falaji) kompleks reabilitatsiya massaji',
      description: 'Reflektor va kinezoterapiya uslubidagi chuqur reabilitatsiya seansi',
      durationMinutes: 60,
      price: 300000,
    },
    {
      name: 'Ploskostopiye va valgus deformatsiyasi massaji',
      description: 'Oyoq panjalari va boldir mushaklarini mustahkamlashga qaratilgan massaj va gimnastika',
      durationMinutes: 40,
      price: 170000,
    },
    {
      name: 'Gipotrofiya va raxit profilaktika massaji',
      description: 'Zaiflashgan bolalar immuniteti va qon aylanishini kuchaytiruvchi yumshoq massaj',
      durationMinutes: 35,
      price: 160000,
    },
    {
      name: 'Elektroforez bilan birgalikdagi kompleks massaj',
      description: 'Dori moddalari va fizioterapiya bilan biriktirilgan terapevtik seans',
      durationMinutes: 45,
      price: 250000,
    },
    {
      name: 'Gidromassaj va shifobaxsh basseyn reabilitatsiyasi',
      description: 'Suv muhitida mushaklar tarangligini yo\'qotish va harakat koordinatsiyasini yaxshilash',
      durationMinutes: 45,
      price: 280000,
    },
    {
      name: 'Logopedik artikulyatsion nuqsonlar massaji',
      description: 'Nutq apparati, yuz va bo\'yin mushaklarini faollashtiruvchi maxsus massaj',
      durationMinutes: 30,
      price: 180000,
    },
    {
      name: 'Bolalar osteopatik korreksiya seansi',
      description: 'Skelet va mushak tizimini yumshoq qo\'l harakatlari bilan muvozanatlash',
      durationMinutes: 50,
      price: 350000,
    },
    {
      name: 'LFK (Davolash jismoniy tarbiyasi) individual mashg\'uloti',
      description: 'Reabilitolog bilan birma-bir bajariladigan faol gimnastika seansi',
      durationMinutes: 45,
      price: 190000,
    },
    {
      name: 'Kichik yoshdagi bolalar kineziteyplash xizmati',
      description: 'Mushaklarni qo\'llab-quvvatlash uchun maxsus elastik teyplar o\'rnatish',
      durationMinutes: 25,
      price: 120000,
    },
    {
      name: 'Umumiy mustahkamlovchi profilaktik massaj',
      description: '3 yoshdan 12 yoshgacha bo\'lgan bolalar immunitetini va uyqusini yaxshilovchi massaj',
      durationMinutes: 40,
      price: 170000,
    },
    {
      name: 'Ekspress massaj kursi (Boshlang\'ich bosqich)',
      description: 'Yangi boshlovchi bolalar uchun adaptatsion qisqa seans',
      durationMinutes: 25,
      price: 130000,
    },
  ];

  const serviceRecords: { id: string; name: string; price: number }[] = [];

  for (const s of servicesData) {
    let service = await prisma.service.findFirst({ where: { name: s.name } });
    if (!service) {
      service = await prisma.service.create({
        data: {
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          price: s.price,
          status: ServiceStatus.ACTIVE,
        },
      });
    }
    serviceRecords.push({ id: service.id, name: service.name, price: service.price });
  }

  // 8. Attendance (60 realistic attendance records)
  console.log('[Seed] 8/12 Seeding 60 Attendance records...');
  const attendanceCount = await prisma.attendance.count();
  if (attendanceCount < 50 && childRecords.length > 0 && specialistRecords.length > 0 && serviceRecords.length > 0) {
    const statuses: AttendanceStatus[] = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.PRESENT,
      AttendanceStatus.LATE,
      AttendanceStatus.ABSENT,
      AttendanceStatus.NO_SHOW,
    ];

    for (let i = 0; i < 60; i++) {
      const child = childRecords[i % childRecords.length]!;
      const specialist = specialistRecords[i % specialistRecords.length]!;
      const service = serviceRecords[i % serviceRecords.length]!;
      const status = statuses[i % statuses.length] ?? AttendanceStatus.PRESENT;

      const now = new Date();
      const dayOffset = -Math.floor((i % 25) + 1);
      const date = new Date(now.getTime() + dayOffset * 86400000);
      date.setHours(9 + (i % 8), (i % 2) * 30, 0, 0);

      await prisma.attendance.create({
        data: {
          childId: child.id,
          specialistId: specialist.id,
          date,
          status,
          note: status === AttendanceStatus.PRESENT ? "O'z vaqtida kelgan va qatnashgan." : 'Qoldirilgan yoki kechikkan.',
        },
      });

      if (status === AttendanceStatus.PRESENT && i % 2 === 0) {
        await prisma.transaction.create({
          data: {
            parentId: child.parentId,
            childId: child.id,
            type: TransactionType.SESSION_CHARGE,
            direction: TransactionDirection.OUT,
            amount: service.price,
            description: `Davolash xizmati uchun hisoblandi: ${service.name}`,
          },
        });
      }
    }
  }

  // 9. Finance: Payments, Ledger & DEBTORS ("Qarzdorlar")
  console.log('[Seed] 9/12 Seeding Payments, Transactions and DEBTORS...');
  const paymentCount = await prisma.payment.count();
  if (paymentCount < 40 && parentRecords.length > 0 && childRecords.length > 0) {
    const methods: PaymentMethod[] = [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER];

    for (let i = 0; i < parentRecords.length; i++) {
      const parent = parentRecords[i]!;
      const child = childRecords.find((c) => c.parentId === parent.id);
      if (!child) continue;

      const groupType = i % 3; // 0 = Debtor (Qarzdor!), 1 = Paid exactly, 2 = Overpaid advance

      if (groupType === 0) {
        // DEBTOR: Two session charges (500,000 UZS) and only 100,000 UZS paid -> Debt = 400,000 UZS
        const sessionChargeAmount = 250000;
        await prisma.transaction.create({
          data: {
            parentId: parent.id,
            childId: child.id,
            type: TransactionType.SESSION_CHARGE,
            direction: TransactionDirection.OUT,
            amount: sessionChargeAmount * 2,
            description: `Reabilitatsiya davolash kursi uchun hisoblangan qarz (2 ta seans)`,
          },
        });

        const partialPayment = 100000;
        await prisma.payment.create({
          data: {
            parentId: parent.id,
            childId: child.id,
            amount: partialPayment,
            method: methods[i % methods.length] ?? PaymentMethod.CASH,
            note: 'Qisman to\'lov (Qarzdorlik qolgan)',
            paidAt: new Date(Date.now() - 3 * 86400000),
          },
        });
        await prisma.transaction.create({
          data: {
            parentId: parent.id,
            childId: child.id,
            type: TransactionType.PAYMENT,
            direction: TransactionDirection.IN,
            amount: partialPayment,
            description: 'Kassaga qisman kiritilgan to\'lov',
          },
        });
      } else if (groupType === 1) {
        // EXACT PAID: Session charged 300,000 and paid 300,000
        const amount = 300000;
        await prisma.transaction.create({
          data: {
            parentId: parent.id,
            childId: child.id,
            type: TransactionType.SESSION_CHARGE,
            direction: TransactionDirection.OUT,
            amount,
            description: 'Massaj kursi uchun to\'lov talabi',
          },
        });
        await prisma.payment.create({
          data: {
            parentId: parent.id,
            childId: child.id,
            amount,
            method: methods[i % methods.length] ?? PaymentMethod.CARD,
            note: 'To\'liq to\'langan seans to\'lovi',
            paidAt: new Date(Date.now() - 5 * 86400000),
          },
        });
        await prisma.transaction.create({
          data: {
            parentId: parent.id,
            childId: child.id,
            type: TransactionType.PAYMENT,
            direction: TransactionDirection.IN,
            amount,
            description: 'Kassaga kiritilgan to\'liq to\'lov',
          },
        });
      } else {
        // ADVANCE BALANCE: Deposit 800,000 UZS
        const advanceAmount = 800000;
        await prisma.payment.create({
          data: {
            parentId: parent.id,
            childId: child.id,
            amount: advanceAmount,
            method: PaymentMethod.CARD,
            note: 'Karta orqali oldindan o\'tkazilgan depozit',
            paidAt: new Date(Date.now() - 2 * 86400000),
          },
        });
        await prisma.transaction.create({
          data: {
            parentId: parent.id,
            childId: child.id,
            type: TransactionType.PAYMENT,
            direction: TransactionDirection.IN,
            amount: advanceAmount,
            description: 'Oldindan kiritilgan depozit mablag\'i',
          },
        });
      }
    }
  }

  // 10. Clinical Records: Assessments, Goals, Progress Entries
  console.log('[Seed] 10/12 Seeding Clinical Assessments, Goals, and Progress...');
  const assessmentCount = await prisma.assessment.count();
  if (assessmentCount < 30 && childRecords.length > 0 && specialistRecords.length > 0) {
    for (let i = 0; i < Math.min(35, childRecords.length); i++) {
      const child = childRecords[i]!;
      const specialist = specialistRecords[i % specialistRecords.length]!;

      await prisma.assessment.create({
        data: {
          childId: child.id,
          specialistId: specialist.id,
          movement: 'Harakat faolligi o\'rtacha, passiv harakatlarda qarshilik seziladi.',
          coordination: 'Qo\'l-oyoq koordinatsiyasi yosh mezonlariga mos rivojlanmoqda.',
          flexibility: 'Bo\'g\'imlar harakatchanligi qoniqarli darajada.',
          activityTolerance: '30 daqiqalik mashg\'ulotni toliq qabul qila oladi.',
          sessionResponse: 'Mashg\'ulot oxirida ijobiy hissiyotlar va bo\'shashish kuzatildi.',
          professionalObservation: 'Terapevtik massaj kursi yaxshi samara bermoqda, tonus me\'yoriga tushmoqda.',
        },
      });

      await prisma.goal.create({
        data: {
          childId: child.id,
          specialistId: specialist.id,
          title: 'Bo\'yin harakati amplitudasini 80% ga yetkazish',
          description: 'Bo\'yin qiyshiqligini bartaraf etish va boshni markaziy holatda ushlashni mustahkamlash.',
          targetDate: new Date(Date.now() + 45 * 86400000),
          status: GoalStatus.ACTIVE,
          progress: 30 + ((i * 7) % 65),
        },
      });

      await prisma.progressEntry.create({
        data: {
          childId: child.id,
          specialistId: specialist.id,
          title: '5-seansdan keyingi ijobiy o\'zgarishlar',
          description: 'Bolaning mushaklaridagi spastik taranglik sezilarli darajada kamaydi, uyqusi normallashdi.',
        },
      });
    }
  }

  // 11. System In-App Notifications
  console.log('[Seed] 11/12 Seeding Notifications...');
  const notifCount = await prisma.notification.count();
  if (notifCount < 20 && parentRecords.length > 0) {
    for (let i = 0; i < Math.min(25, parentRecords.length); i++) {
      const parent = parentRecords[i]!;
      await prisma.notification.create({
        data: {
          userId: parent.userId,
          type: NotificationType.APPOINTMENT,
          priority: NotificationPriority.NORMAL,
          title: 'Yangi qabul belgilandi',
          message: 'Farzandingiz uchun reabilitatsiya massaj seansi muvaffaqiyatli rejalashtirildi.',
          readAt: i % 2 === 0 ? new Date() : null,
        },
      });
    }
  }

  // 12. Verification Summary
  console.log('[Seed] 12/12 Seeding Complete! Verifying database counts:');
  const [
    finalUsers,
    finalAdmins,
    finalSpecialists,
    finalParents,
    finalChildren,
    finalEmployees,
    finalServices,
    finalAttendances,
    finalPayments,
    finalTransactions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.admin.count(),
    prisma.specialist.count(),
    prisma.parent.count(),
    prisma.child.count(),
    prisma.employee.count(),
    prisma.service.count(),
    prisma.attendance.count(),
    prisma.payment.count(),
    prisma.transaction.count(),
  ]);

  console.log(`
=====================================================
🎉 MOCK MA'LUMOTLAR SEEDER MUVAFAQIYATLI YAKUNLANDI!
=====================================================
👥 Jami Foydalanuvchilar (Users): ${finalUsers} ta
👑 Adminlar:                       ${finalAdmins} ta (1 Super Admin + 49 Admin)
🩺 Mutaxassislar (Specialists):    ${finalSpecialists} ta
👨‍👩‍👦 Ota-onalar (Parents):           ${finalParents} ta
👶 Bolalar (Children):             ${finalChildren} ta
🏢 Xodimlar (Employees):           ${finalEmployees} ta
💆 Xizmatlar (Services):           ${finalServices} ta
📋 Davomat (Attendances):          ${finalAttendances} ta
💰 To'lovlar (Payments):           ${finalPayments} ta
📊 Tranzaksiyalar (Qarzdorlar):    ${finalTransactions} ta
=====================================================
🔑 Barcha adminlar paroli:         Admin123!
🔑 Boshqa barcha foydalanuvchilar: Password123!
👑 Super admin:                    admin@massaj.uz / +998901000001
=====================================================
`);
}
