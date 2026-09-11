// ================================================================
// SEED DATA — Default Subjects & Topics for Community Knowledge Hub
// ================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedTopic {
  name: string;
  slug: string;
  description: string;
  order: number;
  children?: SeedTopic[];
}

interface SeedSubject {
  name: string;
  slug: string;
  description: string;
  icon?: string;
  color?: string;
  order: number;
  topics: SeedTopic[];
}

const DEFAULT_SUBJECTS: SeedSubject[] = [
  {
    name: "Toán",
    slug: "toan",
    description: "Môn Toán học - từ cơ bản đến nâng cao",
    icon: "📐",
    color: "#3B82F6",
    order: 1,
    topics: [
      { name: "Đại số", slug: "dai-so", description: "Phương trình, bất phương trình, hàm số", order: 1 },
      { name: "Giải tích", slug: "giai-tich", description: "Đạo hàm, tích phân, giới hạn", order: 2 },
      { name: "Hình học", slug: "hinh-hoc", description: "Hình học phẳng, không gian, giải tích hình học", order: 3 },
      { name: "Xác suất - Thống kê", slug: "xac-suat-thong-ke", description: "Xác suất, tổ hợp, thống kê mô tả", order: 4 },
      { name: "Số học", slug: "so-hoc", description: "Số nguyên, chia hết, đồng dư", order: 5 },
    ],
  },
  {
    name: "Tin học",
    slug: "tin-hoc",
    description: "Khoa học máy tính, lập trình, thuật toán",
    icon: "💻",
    color: "#8B5CF6",
    order: 2,
    topics: [
      {
        name: "Lập trình",
        slug: "lap-trinh",
        description: "Cơ bản lập trình, tư duy thuật toán",
        order: 1,
        children: [
          { name: "C++", slug: "cpp", description: "Lập trình C++ cho thi đấu", order: 1 },
          { name: "Python", slug: "python", description: "Python cho người mới bắt đầu", order: 2 },
          { name: "Java", slug: "java", description: "Java cơ bản và nâng cao", order: 3 },
          { name: "JavaScript", slug: "javascript", description: "Web development với JS", order: 4 },
        ],
      },
      {
        name: "Thuật toán",
        slug: "thuat-toan",
        description: "Các thuật toán kinh điển và kỹ thuật",
        order: 2,
        children: [
          { name: "DFS/BFS", slug: "dfs-bfs", description: "Duyệt đồ thị", order: 1 },
          { name: "Dynamic Programming", slug: "dynamic-programming", description: "Quy hoạch động", order: 2 },
          { name: "Graph Algorithms", slug: "graph-algorithms", description: "Thuật toán đồ thị", order: 3 },
          { name: "Data Structures", slug: "data-structures", description: "Cấu trúc dữ liệu", order: 3 },
          { name: "Greedy", slug: "greedy", description: "Tham lam", order: 4 },
          { name: "Binary Search", slug: "binary-search", description: "Tìm kiếm nhị phân", order: 5 },
        ],
      },
      {
        name: "AI / Machine Learning",
        slug: "ai-ml",
        description: "Trí tuệ nhân tạo, học máy, học sâu",
        order: 3,
        children: [
          { name: "Machine Learning", slug: "machine-learning", description: "Học máy truyền thống", order: 1 },
          { name: "Deep Learning", slug: "deep-learning", description: "Học sâu, neural networks", order: 2 },
          { name: "Computer Vision", slug: "computer-vision", description: "Thị giác máy tính", order: 3 },
          { name: "NLP", slug: "nlp", description: "Xử lý ngôn ngữ tự nhiên", order: 4 },
        ],
      },
      {
        name: "Cơ sở dữ liệu",
        slug: "co-so-du-lieu",
        description: "SQL, NoSQL, thiết kế DB",
        order: 4,
        children: [
          { name: "SQL", slug: "sql", description: "Truy vấn và tối ưu SQL", order: 1 },
          { name: "MongoDB", slug: "mongodb", description: "NoSQL với MongoDB", order: 2 },
          { name: "PostgreSQL", slug: "postgresql", description: "Advanced PostgreSQL", order: 3 },
        ],
      },
      {
        name: "Web Development",
        slug: "web-development",
        description: "Frontend, Backend, Fullstack",
        order: 5,
        children: [
          { name: "React", slug: "react", description: "React.js và ekosystem", order: 1 },
          { name: "Node.js", slug: "nodejs", description: "Backend với Node.js", order: 2 },
          { name: "Next.js", slug: "nextjs", description: "Fullstack React framework", order: 3 },
        ],
      },
    ],
  },
  {
    name: "Vật lý",
    slug: "vat-ly",
    description: "Vật lý học - từ cơ học đến lượng tử",
    icon: "⚛️",
    color: "#EF4444",
    order: 3,
    topics: [
      { name: "Cơ học", slug: "co-hoc", description: "Động lực học, động lực học", order: 1 },
      { name: "Điện từ", slug: "dien-tu", description: "Điện trường, từ trường, sóng điện từ", order: 2 },
      { name: "Nhiệt động lực học", slug: "nhiet-dong-luc-hoc", description: "Nhiệt độ, nhiệt lượng, định luật nhiệt động", order: 3 },
      { name: "Quang học", slug: "quang-hoc", description: "Ánh sáng, lens, giao thoa, nhiễu", order: 4 },
      { name: "Vật lý hiện đại", slug: "vat-ly-hien-dai", description: "Lượng tử, tương đối, hạt nhân", order: 5 },
    ],
  },
  {
    name: "Hóa học",
    slug: "hoa-hoc",
    description: "Hóa học vô cơ, hữu cơ, phân tích",
    icon: "🧪",
    color: "#F59E0B",
    order: 4,
    topics: [
      { name: "Hóa học vô cơ", slug: "hoa-hoc-vo-co", description: "Phản ứng, cân bằng, oxi hóa khử", order: 1 },
      { name: "Hóa học hữu cơ", slug: "hoa-hoc-huu-co", description: "Cấu trúc, phản ứng hữu cơ", order: 2 },
      { name: "Hóa học phân tích", slug: "hoa-hoc-phan-tich", description: "Định lượng, định tính", order: 3 },
      { name: "Hóa lý", slug: "hoa-ly", description: "Nhiệt động hóa học, động lực học hóa học", order: 4 },
    ],
  },
  {
    name: "Sinh học",
    slug: "sinh-hoc",
    description: "Khoa học sự sống - từ tế bào đến hệ sinh thái",
    icon: "🧬",
    color: "#10B981",
    order: 5,
    topics: [
      { name: "Sinh học tế bào", slug: "sinh-hoc-te-bao", description: "Cấu trúc, chức năng tế bào", order: 1 },
      { name: "Di truyền học", slug: "di-truyen-hoc", description: "Gen, đột biến, quy luật Mendel", order: 2 },
      { name: "Sinh hóa học", slug: "sinh-hoa-hoc", description: "Protein, enzym, chuyển hóa", order: 3 },
      { name: "Sinh thái học", slug: "sinh-thai-hoc", description: "Hệ sinh thái, đa dạng sinh học", order: 4 },
      { name: "Sinh học tiến hóa", slug: "sinh-hoc-tien-hoa", description: "Chọn tự nhiên, phân loại", order: 5 },
    ],
  },
  {
    name: "Ngữ văn",
    slug: "ngu-van",
    description: "Văn học, đọc hiểu, viết luận",
    icon: "📖",
    color: "#EC4899",
    order: 6,
    topics: [
      { name: "Đọc hiểu", slug: "doc-hieu", description: "Kỹ năng đọc hiểu văn bản", order: 1 },
      { name: "Viết luận", slug: "viet-luan", description: "Viết văn nghị luận, văn học", order: 2 },
      { name: "Văn học Việt Nam", slug: "van-hoc-viet-nam", description: "Tác phẩm kinh điển Việt Nam", order: 3 },
      { name: "Văn học nước ngoài", slug: "van-hoc-nuoc-ngoai", description: "Tác phẩm kinh điển thế giới", order: 4 },
    ],
  },
  {
    name: "Tiếng Anh",
    slug: "tieng-anh",
    description: "Tiếng Anh giao tiếp, học thuật, IELTS/TOEFL",
    icon: "🇬🇧",
    color: "#06B6D4",
    order: 7,
    topics: [
      { name: "Ngữ pháp", slug: "ngu-phap", description: "Các thì, cấu trúc câu", order: 1 },
      { name: "Từ vựng", slug: "tu-vung", description: "Từ vựng theo chủ đề, cấp độ", order: 2 },
      { name: "IELTS", slug: "ielts", description: "Luyện thi IELTS", order: 3 },
      { name: "TOEFL", slug: "toefl", description: "Luyện thi TOEFL", order: 4 },
      { name: "Tiếng Anh chuyên ngành", slug: "tieng-anh-chuyen-nganh", description: "English for specific purposes", order: 5 },
    ],
  },
  {
    name: "Lịch sử",
    slug: "lich-su",
    description: "Lịch sử Việt Nam và lịch sử thế giới",
    icon: "🏛️",
    color: "#8B5CF6",
    order: 8,
    topics: [
      { name: "Lịch sử Việt Nam", slug: "lich-su-viet-nam", description: "Từ thời kỳ Hồng Bàng đến nay", order: 1 },
      { name: "Lịch sử thế giới", slug: "lich-su-the-gioi", description: "Các nền văn minh, chiến tranh, cách mạng", order: 2 },
    ],
  },
  {
    name: "Địa lý",
    slug: "dia-ly",
    description: "Địa lý tự nhiên, kinh tế, xã hội",
    icon: "🌍",
    color: "#14B8A6",
    order: 9,
    topics: [
      { name: "Địa lý tự nhiên", slug: "dia-ly-tu-nhien", description: "Khí hậu, địa hình, tài nguyên", order: 1 },
      { name: "Địa lý kinh tế", slug: "dia-ly-kinh-te", description: "Phát triển, thương mại, đô thị", order: 2 },
      { name: "Địa lý Việt Nam", slug: "dia-ly-viet-nam", description: "Địa lý Việt Nam chi tiết", order: 3 },
    ],
  },
  {
    name: "Kinh tế",
    slug: "kinh-te",
    description: "Kinh tế học vi mô, vĩ mô, tài chính",
    icon: "💰",
    color: "#F59E0B",
    order: 10,
    topics: [
      { name: "Kinh tế vi mô", slug: "kinh-te-vi-mo", description: "Cung cầu, cân bằng thị trường", order: 1 },
      { name: "Kinh tế vĩ mô", slug: "kinh-te-vi-mo", description: "GDP, lạm phát, chính sách tài khóa", order: 2 },
      { name: "Tài chính", slug: "tai-chinh", description: "Đầu tư, chứng khoán, ngân hàng", order: 3 },
      { name: "Kinh tế quốc tế", slug: "kinh-te-quoc-te", description: "Thương mại, tỷ giá, cân đối thanh toán", order: 4 },
    ],
  },
];

async function seedSubjects() {
  console.log("🌱 Seeding subjects and topics...");

  for (const subjectData of DEFAULT_SUBJECTS) {
    const { topics, ...subjectInfo } = subjectData;
    
    // Create or update subject
    const subject = await prisma.subject.upsert({
      where: { slug: subjectInfo.slug },
      update: subjectInfo,
      create: subjectInfo,
    });

    console.log(`✅ Subject: ${subject.name}`);

    // Create topics
    for (const topicData of topics) {
      const { children, ...topicInfo } = topicData;
      
      const topic = await prisma.subjectTopic.upsert({
        where: { subjectId_slug: { subjectId: subject.id, slug: topicInfo.slug } },
        update: { ...topicInfo, subjectId: subject.id },
        create: { ...topicInfo, subjectId: subject.id },
      });

      console.log(`  📁 Topic: ${topic.name}`);

      // Create child topics (subtopics) — leaves only, no deeper nesting.
      if (children && children.length > 0) {
        for (const childData of children) {
          const childInfo = {
            name: childData.name,
            slug: childData.slug,
            description: childData.description,
            order: childData.order,
          };
          await prisma.subjectTopic.upsert({
            where: { subjectId_slug: { subjectId: subject.id, slug: childInfo.slug } },
            update: { ...childInfo, subjectId: subject.id, parentId: topic.id },
            create: { ...childInfo, subjectId: subject.id, parentId: topic.id },
          });
          console.log(`    📄 Subtopic: ${childInfo.name}`);
        }
      }
    }
  }

  console.log("🎉 Seeding completed!");
}

async function main() {
  try {
    await seedSubjects();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();