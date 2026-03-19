// ...existing code...
import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const ArticleSlider = () => {
  const swiperRef = React.useRef(null);

  const resetAutoplayDelay = () => {
    if (!swiperRef.current || !swiperRef.current.autoplay) return;
    swiperRef.current.autoplay.stop();
    setTimeout(() => swiperRef.current.autoplay.start(), 10000);
  };

  React.useEffect(() => {
    return () => {
      if (swiperRef.current && swiperRef.current.autoplay) {
        swiperRef.current.autoplay.stop();
      }
    };
  }, []);

  return (
    <div className="swiper-container relative">
      <Swiper
        className="mySwiper"
        modules={[Navigation, Pagination, Autoplay]}
        loop={true}
        spaceBetween={0}
        speed={800}
        effect="slide"
        autoplay={{ delay: 5000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation={{ nextEl: ".swiper-button-next", prevEl: ".swiper-button-prev" }}
        onSwiper={(swiper) => (swiperRef.current = swiper)}
      >
        <SwiperSlide>
          <div style={{ height: "300px", background: "red" }}>Slide 1</div>
        </SwiperSlide>

        <SwiperSlide>
          <div style={{ height: "300px", background: "blue" }}>Slide 2</div>
        </SwiperSlide>

        <SwiperSlide>
          <div style={{ height: "300px", background: "green" }}>Slide 3</div>
        </SwiperSlide>
      </Swiper>

      <button className="swiper-button-next" onClick={resetAutoplayDelay}></button>
      <button className="swiper-button-prev" onClick={resetAutoplayDelay}></button>
    </div>
  );
};

export default ArticleSlider