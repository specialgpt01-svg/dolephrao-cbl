<?php

namespace App\Services;

use App\Models\User;
use App\Models\Source;
use App\Models\Base;

class AIService
{
    /**
     * วิเคราะห์ข้อมูลผู้เรียนและสร้างร่างแผน ID Plan อัตโนมัติด้วย AI
     */
    public static function generateIDPlanDraft(User $user, ?string $careerGoal = null, string $digitalLevel = 'Basic'): array
    {
        $tambon = $user->tambon ?: 'ศกร.ระดับตำบลเวียง';
        $category = $user->user_category ?: 'ประชาชนทั่วไป';
        $occupation = $user->occupation ?: 'เกษตรกร';
        $ageGroup = $user->age_group ?: 'วัยทำงาน (18-59 ปี)';
        $goal = $careerGoal ?: "ต้องการพัฒนาทักษะเพื่อเพิ่มรายได้และต่อยอดอาชีพในท้องถิ่น";

        // 🧠 AI Context & Intent Analysis (วิเคราะห์เป้าหมายและความต้องการเฉพาะทาง)
        $goalLower = strtolower($goal);
        
        $intent = 'general';
        if (preg_match('/(พระ|บวช|ธรรมะ|วัด|ศาสนา|สวดมนต์|บาลี|จิตตภาวนา)/u', $goal)) {
            $intent = 'buddhism';
        } else if (preg_match('/(เกษตร|ทำสวน|ลำไย|ชา|ปลูกผัก|ปศุสัตว์|ไร่|ฟาร์ม|ผลไม้)/u', $goal)) {
            $intent = 'agriculture';
        } else if (preg_match('/(หัตถกรรม|ทอผ้า|จักสาน|งานฝีมือ|otop|โอทอป|แกะสลัก)/u', $goal)) {
            $intent = 'handicraft';
        } else if (preg_match('/(สุขภาพ|นวด|สมุนไพร|ผู้สูงอายุ|อนามัย|พยาบาล)/u', $goal)) {
            $intent = 'health';
        } else if (preg_match('/(ช่าง|ซ่อม|มอเตอร์ไซค์|ก่อสร้าง|ไฟฟ้า|เชื่อม|ยนต์)/u', $goal)) {
            $intent = 'mechanic';
        }

        // ดึงแหล่งเรียนรู้และวิดีโอ UpSkill จริงตามหมวด
        $cleanTambon = AuthService::normalizeTambon($tambon);
        $sourcesInTambon = Source::where('tambon', $cleanTambon)->get();
        if ($sourcesInTambon->isEmpty()) {
            $sourcesInTambon = Source::limit(5)->get();
        }
        $primarySource = $sourcesInTambon->first();

        // 1. หมวดเจตจำนง: บวชพระ / พระพุทธศาสนา
        if ($intent === 'buddhism') {
            $strengths[] = 'มีความศรัทธาในพระพุทธศาสนา มีความตั้งใจศึกษาพระธรรมวินัย และการฝึกสมาธิภาวนา';
            $gaps[] = 'ต้องการการเรียนรู้ศาสนพิธี มารยาทชาวพุทธ การอ่านภาษาบาลีเบื้องต้น และการท่องสวดมนต์';

            $buddhismVideo = \App\Models\UpskillVideo::where('category_id', 19)->first()
                ?? \App\Models\UpskillVideo::where('title', 'LIKE', '%ทางโลก%')->first()
                ?? \App\Models\UpskillVideo::first();

            $sourceName = $primarySource ? $primarySource->name : 'ศกร.ระดับตำบลเวียง';

            $recommendedItems[] = [
                'category'          => 'academic',
                'custom_item_title' => 'ภาษาเพื่อการสื่อสารและการบันทึกศาสนกิจ (' . $sourceName . ')',
                'target_hours'      => 15.0,
                'source_id'         => $primarySource?->id,
                'source_name'       => $sourceName,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
            $recommendedItems[] = [
                'category'          => 'vocation',
                'custom_item_title' => 'การศึกษาศาสนพิธี ประเพณีวัฒนธรรมพร้าว ณ ' . $sourceName,
                'target_hours'      => 20.0,
                'source_id'         => $primarySource?->id,
                'source_name'       => $sourceName,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
            $recommendedItems[] = [
                'category'          => 'digital',
                'custom_item_title' => 'การใช้สื่อดิจิทัลและแอปพลิเคชันค้นคว้าธรรมะออนไลน์' . ($buddhismVideo ? " [คอร์สในระบบ: {$buddhismVideo->title}]" : ""),
                'target_hours'      => 15.0,
                'source_id'         => $primarySource?->id,
                'source_name'       => $sourceName,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
        } 
        // 2. หมวดเจตจำนง: เกษตรกรรม
        else if ($intent === 'agriculture') {
            $strengths[] = 'มีทุนทางธรรมชาติและพื้นที่เกษตรกรรม พร้อมเรียนรู้เทคโนโลยีแปรรูปเพื่อเพิ่มมูลค่า';
            $gaps[] = 'ต้องการยกระดับการแปรรูปผลผลิต การบริหารต้นทุนฟาร์ม และการขยายตลาดออนไลน์';

            $agriVideo = \App\Models\UpskillVideo::where('category_id', 23)->first()
                ?? \App\Models\UpskillVideo::first();

            $recommendedItems[] = [
                'category'          => 'academic',
                'custom_item_title' => 'การคิดคำนวณต้นทุน-กำไรทางการเกษตร และการทำบัญชีฟาร์มพร้าว',
                'target_hours'      => 15.0,
                'source_id'         => $primarySource?->id,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
            $recommendedItems[] = [
                'category'          => 'vocation',
                'custom_item_title' => 'การแปรรูปผลผลิตทางการเกษตรพร้าวและการสร้างแบรนด์ชุมชนร่วมกับปราชญ์ชาวบ้าน',
                'target_hours'      => 20.0,
                'source_id'         => $sourcesInTambon->skip(1)->first()?->id ?? $primarySource?->id,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
            $recommendedItems[] = [
                'category'          => 'digital',
                'custom_item_title' => 'การใช้สมาร์ทโฟนเปิดร้านค้าออนไลน์และการถ่ายภาพสินค้าเกษตร' . ($agriVideo ? " (วิดีโอ: {$agriVideo->title})" : ""),
                'target_hours'      => 15.0,
                'source_id'         => $primarySource?->id,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
        }
        // 3. หมวดเจตจำนง: หัตถกรรม / OTOP
        else if ($intent === 'handicraft') {
            $strengths[] = 'มีทักษะฝีมือประณีต ละเมียดละไม และเป็นผู้สืบทอดมรดกภูมิปัญญาท้องถิ่นพร้าว';
            $gaps[] = 'ต้องการการดีไซน์บรรจุภัณฑ์ การตั้งราคาอย่างมีมาตรฐาน และการขยายช่องทางขายออนไลน์';

            $recommendedItems[] = [
                'category'          => 'academic',
                'custom_item_title' => 'ภาษาเพื่อการขายและการสื่อสารเรื่องราวผลิตภัณฑ์ชุมชน (Storytelling)',
                'target_hours'      => 15.0,
                'source_id'         => $primarySource?->id,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
            $recommendedItems[] = [
                'category'          => 'vocation',
                'custom_item_title' => 'การพัฒนาผลิตภัณฑ์หัตถกรรมภูมิปัญญาท้องถิ่นพร้าวและบรรจุภัณฑ์ OTOP',
                'target_hours'      => 20.0,
                'source_id'         => $primarySource?->id,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
            $recommendedItems[] = [
                'category'          => 'digital',
                'custom_item_title' => 'การสร้างโปรไฟล์ร้านค้าดิจิทัล และการถ่ายภาพสินค้า OTOP ผ่านสมาร์ทโฟน',
                'target_hours'      => 15.0,
                'source_id'         => $primarySource?->id,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
        }
        // 4. หมวดทั่วไป / อื่นๆ
        else {
            if (str_contains($category, 'ชาติพันธุ์') || str_contains($category, 'ศศช.')) {
                $strengths[] = 'มีความเชี่ยวชาญในทุนทางวัฒนธรรม การแปรรูปผลผลิตการเกษตรท้องถิ่น และภูมิปัญญาสมุนไพร';
                $gaps[] = 'ระดับทักษะการรู้ดิจิทัล (Digital Literacy) และภาษาไทยอยู่ในระดับเริ่มต้น';
            } else if (str_contains($category, 'ผู้สูงอายุ')) {
                $strengths[] = 'มีประสบการณ์ชีวิตสูง มีภูมิปัญญาท้องถิ่นและการดูแลสุขภาพแบบพึ่งตนเอง';
                $gaps[] = 'ขาดทักษะการใช้สมาร์ทโฟนรู้เท่าทันภัยไซเบอร์และการใช้แอปพลิเคชันบริการรัฐ';
            } else {
                $strengths[] = "มีความพร้อมในการเรียนรู้ทักษะใหม่ และต้องการมุ่งสู่เป้าหมาย: {$goal}";
                $gaps[] = 'ต้องการการยกระดับทักษะเฉพาะทาง การบริหารเวลา และทักษะดิจิทัลร่วมสมัย';
            }

            $digitalVideo = \App\Models\UpskillVideo::where('is_active', true)->first();

            $recommendedItems[] = [
                'category'          => 'academic',
                'custom_item_title' => 'การคิดคำนวณ การทำบัญชี และภาษาเพื่อการสื่อสารประจำวัน',
                'target_hours'      => 15.0,
                'source_id'         => $primarySource?->id,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
            $recommendedItems[] = [
                'category'          => 'vocation',
                'custom_item_title' => "การพัฒนาทักษะเฉพาะทางเพื่อการมุ่งสู่: {$goal}",
                'target_hours'      => 20.0,
                'source_id'         => $primarySource?->id,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
            $recommendedItems[] = [
                'category'          => 'digital',
                'custom_item_title' => 'การใช้สมาร์ทโฟนค้นคว้าข้อมูลและใช้งานแอปพลิเคชันดิจิทัลร่วมสมัย' . ($digitalVideo ? " (วิดีโอ: {$digitalVideo->title})" : ""),
                'target_hours'      => 15.0,
                'source_id'         => $primarySource?->id,
                'base_id'           => null,
                'assigned_sage'     => null,
            ];
        }

        return [
            'title'                 => "แผนพัฒนาตนเองรายบุคคล: สู่การเป็น {$goal}",
            'target_career_goal'    => $goal,
            'initial_digital_level' => $digitalLevel,
            'strengths'             => $strengths,
            'gaps'                  => $gaps,
            'academic_target_hours' => 15.0,
            'vocation_target_hours' => 20.0,
            'digital_target_hours'  => 15.0,
            'inactivity_days_threshold' => 20,
            'items'                 => $recommendedItems,
        ];
    }
}
